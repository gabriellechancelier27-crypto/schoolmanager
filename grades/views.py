from django.shortcuts import render

# Create your views here.
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from academics.models import TeachingAssignment
from communication.services import notify_student
from core.mixins import SchoolScopedMixin, ensure_same_school
from core.permissions import CanEnterGrades, IsManager, IsSchoolAdmin, ReadOnlyOrManager
from core.services import log_activity

from .models import Grade, Period, ReportCard
from .pdf import build_report_card_pdf
from .serializers import (BulkGradeSerializer, ComputeReportSerializer, GradeSerializer,
                          PeriodSerializer, ReportCardSerializer)
from .services import compute_class_report_cards


def assert_teacher_can_grade(user, subject, class_room, school_year):
    """Un enseignant ne note que ses propres affectations (§3.4)."""
    if user.is_super_admin or user.role in ("SCHOOL_ADMIN", "DIRECTOR"):
        return None
    teacher = getattr(user, "teacher_profile", None)
    if teacher is None:
        raise PermissionDenied("Profil enseignant introuvable.")
    if not TeachingAssignment.objects.filter(teacher=teacher, subject=subject,
                                             class_room=class_room,
                                             school_year=school_year).exists():
        raise PermissionDenied("Vous n'enseignez pas cette matière dans cette classe.")
    return teacher


class PeriodViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    queryset = Period.objects.select_related("school_year")
    serializer_class = PeriodSerializer
    permission_classes = [ReadOnlyOrManager]
    filterset_fields = ["school_year", "is_locked"]

    @action(detail=True, methods=["post"], permission_classes=[IsSchoolAdmin])
    def lock(self, request, pk=None):
        period = self.get_object()
        period.is_locked = True   # résultats verrouillables (§5.2)
        period.save()
        return Response(PeriodSerializer(period).data)

    @action(detail=True, methods=["post"], permission_classes=[IsSchoolAdmin])
    def unlock(self, request, pk=None):
        period = self.get_object()
        period.is_locked = False
        period.save()
        return Response(PeriodSerializer(period).data)


class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.select_related("enrollment__student", "enrollment__class_room",
                                            "subject", "period", "teacher")
    serializer_class = GradeSerializer
    filterset_fields = ["period", "subject", "assessment_type", "enrollment"]
    search_fields = ["enrollment__student__matricule", "enrollment__student__first_name",
                     "enrollment__student__last_name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "bulk"):
            return [CanEnterGrades()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_super_admin:
            return qs
        if not user.school_id:
            return qs.none()
        qs = qs.filter(enrollment__student__school=user.school)
        if user.role == "TEACHER" and hasattr(user, "teacher_profile"):
            # couples (classe, matière) exacts de ses affectations
            pairs = list(TeachingAssignment.objects
                         .filter(teacher=user.teacher_profile)
                         .values_list("class_room_id", "subject_id"))
            if not pairs:
                return qs.none()
            condition = Q()
            for class_id, subject_id in pairs:
                condition |= Q(enrollment__class_room_id=class_id, subject_id=subject_id)
            qs = qs.filter(condition)
        elif user.role == "PARENT":
            qs = qs.filter(enrollment__student__student_parents__parent__user=user).distinct()
        elif user.role == "STUDENT":
            qs = qs.filter(enrollment__student__user=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        enrollment = serializer.validated_data["enrollment"]
        subject, period = serializer.validated_data["subject"], serializer.validated_data["period"]
        if not user.is_super_admin and enrollment.student.school_id != user.school_id:
            raise PermissionDenied
        ensure_same_school(user, [subject, period])
        teacher = assert_teacher_can_grade(user, subject, enrollment.class_room,
                                           period.school_year)
        grade = serializer.save(teacher=teacher, created_by=user)
        log_activity(user, "CREATE", grade, f"Note {grade.value} en {subject} ({period})")
        notify_student(enrollment.student, "Nouvelle note",
                       f"{subject.name} — {period.name} : {grade.value}/20.")

    def perform_update(self, serializer):
        user = self.request.user
        grade = serializer.instance
        teacher = assert_teacher_can_grade(user, grade.subject,
                                           grade.enrollment.class_room,
                                           grade.period.school_year)
        grade = serializer.save(teacher=teacher or grade.teacher)
        log_activity(user, "GRADE_EDIT", grade, "Modification de note")

    def perform_destroy(self, instance):
        user = self.request.user
        if instance.period.is_locked:
            raise ValidationError({"detail": "Période verrouillée : suppression interdite."})
        assert_teacher_can_grade(user, instance.subject, instance.enrollment.class_room,
                                 instance.period.school_year)
        log_activity(user, "GRADE_EDIT", instance,
                     f"Suppression de la note {instance.value} "
                     f"({instance.enrollment.student}, {instance.subject}, {instance.period})")
        instance.delete()

    @action(detail=False, methods=["post"], permission_classes=[CanEnterGrades])
    def bulk(self, request):
        """Saisie groupée de notes (§4.9)."""
        serializer = BulkGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        class_room, subject, period = data["class_room"], data["subject"], data["period"]
        user = request.user
        if not user.is_super_admin and class_room.school_id != user.school_id:
            raise PermissionDenied
        teacher = assert_teacher_can_grade(user, subject, class_room, period.school_year)
        for note in data["notes"]:
            Grade.objects.update_or_create(
                enrollment=note["enrollment"], subject=subject, period=period,
                assessment_type=data["assessment_type"], sequence=data["sequence"],
                defaults={"value": note["value"], "coefficient": note["coefficient"],
                          "teacher": teacher, "created_by": user})
        log_activity(user, "GRADE_EDIT", subject,
                     f"Saisie groupée : {len(data['notes'])} notes ({class_room}/{period}).")
        for note in data["notes"]:
            notify_student(note["enrollment"].student, "Nouvelle note",
                           f"{subject.name} — {period.name} : {note['value']}/20.")
        return Response({"enregistrees": len(data["notes"])})


class ReportCardViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (ReportCard.objects
                .select_related("enrollment__student", "enrollment__class_room",
                                "enrollment__school_year", "period")
                .prefetch_related("lines__subject"))
    serializer_class = ReportCardSerializer
    filterset_fields = ["period"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        class_id = self.request.query_params.get("classe")
        if class_id:
            qs = qs.filter(enrollment__class_room_id=class_id)
        if user.is_super_admin:
            return qs
        if not user.school_id:
            return qs.none()
        qs = qs.filter(enrollment__student__school=user.school)
        if user.role == "PARENT":
            qs = qs.filter(enrollment__student__student_parents__parent__user=user).distinct()
        elif user.role == "STUDENT":
            qs = qs.filter(enrollment__student__user=user)
        return qs

    @action(detail=False, methods=["post"], permission_classes=[IsManager])
    def compute(self, request):
        """Calcul des moyennes, classements et bulletins (§4.11)."""
        serializer = ComputeReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        class_room, period = data["class_room"], data["period"]
        if not request.user.is_super_admin and class_room.school_id != request.user.school_id:
            raise PermissionDenied
        stats = compute_class_report_cards(class_room=class_room, period=period)
        log_activity(request.user, "VALIDATION", period,
                     f"Calcul des bulletins {class_room} — {period}")
        return Response(stats)

    @action(detail=False, methods=["get"])
    def ranking(self, request):
        """Classement d'une classe : ?period=<id>&classe=<id>."""
        period_id = request.query_params.get("period")
        if not period_id:
            return Response({"detail": "Paramètre « period » requis."}, status=400)
        qs = self.get_queryset().filter(period_id=period_id, rank__isnull=False).order_by("rank")
        return Response([{"rang": rc.rank, "eleve": str(rc.enrollment.student),
                          "moyenne": rc.average, "mention": rc.mention} for rc in qs[:200]])

    @action(detail=True, methods=["post"], permission_classes=[IsSchoolAdmin])
    def validate(self, request, pk=None):
        report_card = self.get_object()
        report_card.is_validated = True
        report_card.save(update_fields=["is_validated"])
        return Response(ReportCardSerializer(report_card).data)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        report_card = self.get_object()
        response = HttpResponse(build_report_card_pdf(report_card), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="bulletin_{report_card.enrollment.student.matricule}.pdf"')
        return response