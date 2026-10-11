from rest_framework.exceptions import PermissionDenied, ValidationError


def ensure_same_school(user, values):
    """Refuse tout objet lié qui appartient à un autre établissement (§11.2)."""
    if user.is_super_admin:
        return
    for value in values:
        school_id = getattr(value, "school_id", None)
        if school_id is not None and school_id != user.school_id:
            raise PermissionDenied("Objet hors de votre établissement.")


class SchoolScopedMixin:
    """Séparation logique des données par établissement (§11.2).
    Filtre les querysets et force l'établissement à la création / modification."""

    school_field = "school"  # supporte les traversées, ex. "student__school"

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and not user.is_super_admin:
            qs = qs.filter(**{self.school_field: user.school_id}) if user.school_id else qs.none()
        return qs

    def _resolve_school(self, serializer):
        """Établissement à enregistrer : celui de l'utilisateur, ou (super admin)
        celui fourni / déduit d'un objet lié."""
        user = self.request.user
        if not user.is_super_admin:
            if user.school_id is None:
                raise PermissionDenied("Compte non rattaché à un établissement.")
            return user.school
        data = serializer.validated_data
        if data.get("school") is not None:
            return data["school"]
        for value in data.values():
            school = getattr(value, "school", None)
            if school is not None:
                return school
        raise ValidationError({"school": "Établissement requis."})

    def perform_create(self, serializer):
        user = self.request.user
        ensure_same_school(user, serializer.validated_data.values())
        if hasattr(serializer.Meta.model, "school"):
            serializer.save(school=self._resolve_school(serializer))
        else:
            serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        ensure_same_school(user, serializer.validated_data.values())
        if not user.is_super_admin and hasattr(serializer.Meta.model, "school"):
            serializer.save(school=user.school)
        else:
            serializer.save()