from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import SchoolScopedMixin
from core.permissions import IsSchoolAdmin, IsSuperAdmin, ReadOnlyOrManager

from .models import School, SchoolYear
from .serializers import SchoolSerializer, SchoolYearSerializer


class SchoolViewSet(viewsets.ModelViewSet):
    """Création/gestion des établissements — super admin uniquement (§3.1)."""
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    permission_classes = [IsSuperAdmin]
    search_fields = ["name", "code", "city"]


class SchoolYearViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    queryset = SchoolYear.objects.select_related("school")
    serializer_class = SchoolYearSerializer
    permission_classes = [ReadOnlyOrManager]
    filterset_fields = ["is_current", "is_archived"]
    search_fields = ["label"]

    @action(detail=True, methods=["post"], permission_classes=[IsSchoolAdmin])
    def archive(self, request, pk=None):
        year = self.get_object()
        year.is_archived = True
        year.is_current = False
        year.save()
        return Response(SchoolYearSerializer(year).data)