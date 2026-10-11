from django.shortcuts import render

# Create your views here.
from django.db.models import Count, Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from academics.models import TeachingAssignment
from communication.services import notify_student
from core.mixins import ensure_same_school
from core.permissions import CanRecordAttendance

from .models import Attendance
from .serializers import AttendanceCallSerializer, AttendanceSerializer


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related("student", "class_room", "subject",
                                                 "school_year", "recorded_by")
    serializer_class = AttendanceSerializer
    filterset_fields = ["status", "date", "class_room", "subject", "school_year"]
    search_fields = ["student__matricule", "student__first_name", "student__last_name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "call"):
            return [CanRecordAttendance()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_super_admin:
            return qs
        if not user.school_id:
            return qs.none()
        qs = qs.filter(student__school=user.school)
        if user.role == "PARENT":
            qs = qs.filter(student__student_parents__parent__user=user).distinct()
        elif user.role == "STUDENT":
            qs = qs.filter(student__user=user)
        return qs

    def _check_school(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        ensure_same_school(user, [data.get("student"), data.get("class_room"),
                                  data.get("school_year"), data.get("subject")])

    def perform_create(self, serializer):
        self._check_school(serializer)
        serializer.save(recorded_by=self.request.user)

    def perform_update(self, serializer):
        self._check_school(serializer)
        serializer.save()

    @action(detail=False, methods=["post"], permission_classes=[CanRecordAttendance])
    def call(self, request):
        """Faire l'appel : {class_room_id, school_year_id, date, entries: [...] }."""
        serializer = AttendanceCallSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        class_room, school_year, date = data["class_room"], data["school_year"], data["date"]
        subject = data.get("subject")
        user = request.user
        if not user.is_super_admin:
            if class_room.school_id != user.school_id:
                raise PermissionDenied
            if user.role == "TEACHER":
                teacher = getattr(user, "teacher_profile", None)
                if teacher and not TeachingAssignment.objects.filter(
                        teacher=teacher, class_room=class_room, school_year=school_year).exists():
                    raise PermissionDenied("Vous n'enseignez pas dans cette classe.")
        for entry in data["entries"]:
            Attendance.objects.update_or_create(
                student=entry["student"], date=date, class_room=class_room, subject=subject,
                defaults={"school_year": school_year, "status": entry["status"],
                          "minutes_late": entry["minutes_late"], "reason": entry["reason"],
                          "start_time": data.get("start_time"), "recorded_by": user})
            if entry["status"] in ("ABSENT", "LATE"):
                notify_student(entry["student"], "Absence enregistrée",
                               f"Statut du {date} : {entry['status']}.")
        return Response({"enregistres": len(data["entries"])})

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Statistiques d'absence (§4.12) : ?debut=2025-10-01&fin=2025-12-12."""
        qs = self.filter_queryset(self.get_queryset())
        start, end = request.query_params.get("debut"), request.query_params.get("fin")
        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        total = qs.count()
        if total == 0:
            return Response({"total": 0})
        counts = qs.aggregate(
            absents=Count("id", filter=Q(status="ABSENT")),
            retards=Count("id", filter=Q(status="LATE")),
            justifiees=Count("id", filter=Q(status="EXCUSED")),
            presents=Count("id", filter=Q(status="PRESENT")))
        counts["total"] = total
        counts["taux_absenteisme"] = round(counts["absents"] / total * 100, 1)
        return Response(counts)