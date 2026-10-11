from django.shortcuts import render

# Create your views here.
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from academics.models import ClassRoom, Enrollment, Student, Teacher
from attendance.models import Attendance
from finance.models import Expense, Payment
from finance.services import school_financial_summary
from grades.models import ReportCard
from schools.models import School, SchoolYear

from .mixins import SchoolScopedMixin
from .models import ActivityLog, User
from .permissions import IsManager, IsSchoolAdmin
from .serializers import (ActivityLogSerializer, ChangePasswordSerializer,
                          LoginSerializer, UserCreateSerializer, UserSerializer)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        data = UserSerializer(user).data
        teacher = getattr(user, "teacher_profile", None)
        if teacher:
            data["teacher_id"] = teacher.id
        parent = getattr(user, "parent_profile", None)
        if parent:
            data["parent_id"] = parent.id
            data["children"] = [{"id": s.id, "matricule": s.matricule, "nom": str(s),
                                 "classe": s.current_class_name} for s in parent.children]
        student = getattr(user, "student_profile", None)
        if student:
            data["student_id"] = student.id
            data["classe"] = student.current_class_name
        return Response(data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Mot de passe modifié avec succès."})


class UserViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    """Gestion des comptes par l'administrateur d'établissement (§3.2)."""
    queryset = User.objects.filter(is_superuser=False).order_by("username")
    permission_classes = [IsSchoolAdmin]
    filterset_fields = ["role", "is_active"]
    search_fields = ["username", "first_name", "last_name"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        return super().get_queryset().exclude(role="SUPER_ADMIN")

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_super_admin:
            serializer.save()
        else:
            serializer.save(school=user.school)  # l'admin ne crée que dans son établissement

    def perform_update(self, serializer):
        user = self.request.user
        if user.is_super_admin:
            serializer.save()
        else:
            serializer.save(school=user.school)


class ActivityLogViewSet(SchoolScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.select_related("user")
    serializer_class = ActivityLogSerializer
    permission_classes = [IsManager]
    filterset_fields = ["action", "model"]


class DashboardView(APIView):
    """Indicateurs adaptés au rôle (§4.1, §15)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_super_admin:
            return Response({
                "etablissements": School.objects.count(),
                "etablissements_actifs": School.objects.filter(is_active=True).count(),
                "utilisateurs": User.objects.filter(is_superuser=False).count(),
            })

        school = user.school
        if school is None:
            return Response({"detail": "Compte non rattaché à un établissement."}, status=400)

        year = SchoolYear.objects.filter(school=school, is_current=True).first()
        data = {"etablissement": school.name, "annee_scolaire": year.label if year else None}

        # --- Élève (§3.7)
        if user.role == "STUDENT":
            student = getattr(user, "student_profile", None)
            if student:
                report = (ReportCard.objects.filter(enrollment__student=student)
                          .order_by("-period__start_date").first())
                data.update({
                    "moyenne": report.average if report else None,
                    "rang": report.rank if report else None,
                    "mention": report.mention if report else None,
                    "absences": Attendance.objects.filter(student=student, status="ABSENT").count(),
                    "retards": Attendance.objects.filter(student=student, status="LATE").count(),
                })
            return Response(data)

        # --- Parent (§3.6)
        if user.role == "PARENT":
            parent = getattr(user, "parent_profile", None)
            enfants = []
            for student in (parent.children if parent else []):
                report = (ReportCard.objects.filter(enrollment__student=student)
                          .order_by("-period__start_date").first())
                enfants.append({"eleve": str(student), "matricule": student.matricule,
                                "classe": student.current_class_name,
                                "moyenne": report.average if report else None,
                                "rang": report.rank if report else None})
            data["enfants"] = enfants
            return Response(data)

        # --- Personnel
        students = Student.objects.filter(school=school)
        data.update({
            "eleves": students.filter(status="ACTIVE").count(),
            "garcons": students.filter(status="ACTIVE", gender="M").count(),
            "filles": students.filter(status="ACTIVE", gender="F").count(),
            "enseignants": Teacher.objects.filter(school=school, status="ACTIVE").count(),
            "classes": ClassRoom.objects.filter(school=school, is_active=True).count(),
            "inscriptions": Enrollment.objects.filter(school_year=year).count() if year else 0,
            "absences_30j": Attendance.objects.filter(
                student__school=school, status="ABSENT",
                date__gte=timezone.localdate() - timedelta(days=30)).count(),
        })

        # --- Volet financier (§6.4)
        if year and user.role in ("SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"):
            recettes = (Payment.objects.filter(school=school, enrollment__school_year=year)
                        .aggregate(total=Sum("amount"))["total"] or 0)
            depenses = (Expense.objects.filter(school=school, school_year=year)
                        .aggregate(total=Sum("amount"))["total"] or 0)
            finance = school_financial_summary(school, year)
            data.update({"recettes": recettes, "depenses": depenses,
                         "solde": recettes - depenses,
                         "impayes": finance["impayes"],
                         "taux_recouvrement": finance["taux_recouvrement"]})
        return Response(data)