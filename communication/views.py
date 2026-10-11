from django.shortcuts import render

# Create your views here.
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from academics.models import Enrollment
from core.mixins import SchoolScopedMixin, ensure_same_school
from core.permissions import IsManager

from .models import Announcement, Notification
from .serializers import AnnouncementSerializer, NotificationSerializer
from .services import notify_users

User = get_user_model()


class AnnouncementViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    queryset = Announcement.objects.select_related("author", "class_room")
    serializer_class = AnnouncementSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsManager()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()   # déjà filtré par établissement
        user = self.request.user
        if user.is_super_admin:
            return qs
        if user.role in ("STUDENT", "PARENT"):
            if user.role == "STUDENT":
                enrollments = Enrollment.objects.filter(student__user=user, status="ACTIVE")
            else:
                enrollments = Enrollment.objects.filter(
                    student__student_parents__parent__user=user, status="ACTIVE")
            class_ids = list(enrollments.values_list("class_room_id", flat=True))
            qs = qs.filter(Q(target="ALL")
                           | Q(target="CLASS", class_room_id__in=class_ids)
                           | Q(target="ROLE", role=user.role))
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        ensure_same_school(user, serializer.validated_data.values())
        announcement = serializer.save(school=self._resolve_school(serializer), author=user)
        self._notify(announcement)

    def _notify(self, announcement):
        school = announcement.school
        if announcement.target == "ALL":
            recipients = User.objects.filter(school=school, is_active=True)
        elif announcement.target == "ROLE":
            recipients = User.objects.filter(school=school, role=announcement.role, is_active=True)
        else:
            student_ids = list(Enrollment.objects.filter(
                class_room=announcement.class_room, status="ACTIVE"
            ).values_list("student_id", flat=True))
            recipients = User.objects.filter(
                Q(student_profile__id__in=student_ids) |
                Q(parent_profile__student_parents__student_id__in=student_ids),
                school=school, is_active=True).distinct()
        notify_users(recipients, f"Annonce : {announcement.title}", announcement.body[:300])


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Notification.objects.all()   # requis par le routeur ; filtré dans get_queryset
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"detail": "Notifications marquées comme lues."})