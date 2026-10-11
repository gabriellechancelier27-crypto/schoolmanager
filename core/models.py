from django.db import models

# Create your models here.
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Utilisateur de la plateforme, tous rôles confondus (§3)."""

    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super administrateur"
        SCHOOL_ADMIN = "SCHOOL_ADMIN", "Administrateur d'établissement"
        DIRECTOR = "DIRECTOR", "Directeur"
        TEACHER = "TEACHER", "Enseignant"
        ACCOUNTANT = "ACCOUNTANT", "Comptable"
        PARENT = "PARENT", "Parent / Tuteur"
        STUDENT = "STUDENT", "Élève"

    role = models.CharField("rôle", max_length=20, choices=Role.choices)
    school = models.ForeignKey("schools.School", verbose_name="établissement",
                               null=True, blank=True, on_delete=models.CASCADE,
                               related_name="users")
    phone = models.CharField("téléphone", max_length=30, blank=True)

    @property
    def is_super_admin(self) -> bool:
        return self.is_superuser or self.role == self.Role.SUPER_ADMIN

    def save(self, *args, **kwargs):
        # un compte créé par « createsuperuser » reçoit automatiquement le rôle SUPER_ADMIN
        if self.is_superuser and not self.role:
            self.role = self.Role.SUPER_ADMIN
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"


class ActivityLog(models.Model):
    """Journal des opérations sensibles (§7.4)."""

    class Action(models.TextChoices):
        CREATE = "CREATE", "Création"
        UPDATE = "UPDATE", "Modification"
        DELETE = "DELETE", "Suppression"
        LOGIN = "LOGIN", "Connexion"
        GRADE_EDIT = "GRADE_EDIT", "Modification de note"
        PAYMENT = "PAYMENT", "Paiement"
        VALIDATION = "VALIDATION", "Validation"

    school = models.ForeignKey("schools.School", null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="logs")
    user = models.ForeignKey("core.User", null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="logs")
    action = models.CharField(max_length=20, choices=Action.choices)
    model = models.CharField(max_length=60, blank=True)
    object_id = models.CharField(max_length=60, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "journal d'activité"

    def __str__(self):
        return f"[{self.created_at:%d/%m/%Y %H:%M}] {self.action} {self.model}"