from django.shortcuts import render

# Create your views here.
from django.http import HttpResponse
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from academics.models import Enrollment
from communication.services import notify_student
from core.mixins import SchoolScopedMixin, ensure_same_school
from core.permissions import IsAccountantOrManager, IsManager, IsSchoolStaff
from core.services import log_activity
from schools.models import SchoolYear

from .models import Expense, Fee, Payment
from .pdf import build_receipt_pdf
from .serializers import ExpenseSerializer, FeeSerializer, PaymentSerializer
from .services import enrollment_balance


class FeeViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    queryset = Fee.objects.select_related("school_year", "class_room")
    serializer_class = FeeSerializer
    filterset_fields = ["school_year", "category", "class_room", "is_active"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAccountantOrManager()]
        return [IsSchoolStaff()]


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("enrollment__student", "enrollment__class_room",
                                              "fee", "recorded_by")
    serializer_class = PaymentSerializer
    filterset_fields = ["method", "enrollment", "paid_at"]
    search_fields = ["receipt_number", "enrollment__student__matricule",
                     "enrollment__student__last_name"]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsManager()]   # supprimer un reçu : administrateur / directeur uniquement
        if self.action in ("create", "update", "partial_update", "outstanding"):
            return [IsAccountantOrManager()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_super_admin:
            return qs
        if not user.school_id:
            return qs.none()
        qs = qs.filter(school=user.school)
        if user.role == "PARENT":
            qs = qs.filter(enrollment__student__student_parents__parent__user=user).distinct()
        elif user.role == "STUDENT":
            qs = qs.filter(enrollment__student__user=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        enrollment = serializer.validated_data["enrollment"]
        school = enrollment.student.school
        if not user.is_super_admin and school.id != user.school_id:
            raise PermissionDenied("Inscription hors établissement.")
        ensure_same_school(user, [serializer.validated_data.get("fee")])
        payment = serializer.save(school=school, recorded_by=user)
        log_activity(user, "PAYMENT", payment,
                     f"Paiement {payment.receipt_number} : {payment.amount} {school.currency}")
        notify_student(enrollment.student, "Paiement enregistré",
                       f"Reçu n° {payment.receipt_number} — {payment.amount} {school.currency}.")

    def perform_update(self, serializer):
        user = self.request.user
        enrollment = serializer.validated_data.get("enrollment", serializer.instance.enrollment)
        if not user.is_super_admin and enrollment.student.school_id != user.school_id:
            raise PermissionDenied("Inscription hors établissement.")
        ensure_same_school(user, [serializer.validated_data.get("fee")])
        payment = serializer.save()
        log_activity(user, "UPDATE", payment, f"Modification du paiement {payment.receipt_number}")

    def perform_destroy(self, instance):
        log_activity(self.request.user, "DELETE", instance,
                     f"Suppression du paiement {instance.receipt_number} : {instance.amount}")
        instance.delete()

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        payment = self.get_object()
        response = HttpResponse(build_receipt_pdf(payment), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="recu_{payment.receipt_number}.pdf"'
        return response

    @action(detail=False, methods=["get"], url_path="outstanding")
    def outstanding(self, request):
        """Impayés (§4.16) : ?classe=<id>&annee=<id>."""
        user = request.user
        school = user.school
        if school is None:
            return Response({"detail": "Compte non rattaché à un établissement."}, status=400)
        year_id = request.query_params.get("annee")
        school_year = (SchoolYear.objects.filter(pk=year_id, school=school).first() if year_id
                       else SchoolYear.objects.filter(school=school, is_current=True).first())
        if school_year is None:
            return Response({"detail": "Aucune année scolaire trouvée."}, status=400)
        qs = (Enrollment.objects.filter(school_year=school_year,
              status=Enrollment.Status.ACTIVE).select_related("student", "class_room"))
        class_id = request.query_params.get("classe")
        if class_id:
            qs = qs.filter(class_room_id=class_id)
        data = []
        for enrollment in qs:
            balance = enrollment_balance(enrollment)
            state = ("SOLDE" if balance["reste"] <= 0
                     else "PARTIEL" if balance["paye"] > 0 else "IMPAYE")
            data.append({"inscription": enrollment.id, "eleve": str(enrollment.student),
                         "matricule": enrollment.student.matricule,
                         "classe": enrollment.class_room.name, "du": balance["du"],
                         "paye": balance["paye"], "reste": balance["reste"],
                         "situation": state})
        return Response(data)


class ExpenseViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("school_year")
    serializer_class = ExpenseSerializer
    permission_classes = [IsAccountantOrManager]
    filterset_fields = ["category", "school_year", "date"]

    def perform_create(self, serializer):
        user = self.request.user
        ensure_same_school(user, serializer.validated_data.values())
        serializer.save(school=self._resolve_school(serializer), recorded_by=user)