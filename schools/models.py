from django.db import models

# Create your models here.
from django.db import models


class School(models.Model):
    """Établissement scolaire — racine du multi-établissements (§11.2)."""

    name = models.CharField("nom", max_length=200)
    code = models.CharField("code", max_length=20, unique=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    city = models.CharField("ville", max_length=100, blank=True)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    email = models.EmailField("email", blank=True)
    logo = models.ImageField("logo", upload_to="schools/logos/", null=True, blank=True)
    currency = models.CharField("devise", max_length=10, default="FCFA")  # §16.1
    grade_scale = models.DecimalField("échelle de notes", max_digits=4, decimal_places=1, default=20)
    pass_mark = models.DecimalField("moyenne de passage", max_digits=4, decimal_places=1, default=10)
    is_active = models.BooleanField("actif", default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SchoolYear(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="school_years")
    label = models.CharField("libellé", max_length=20, help_text="Ex. : 2025-2026")
    start_date = models.DateField("début")
    end_date = models.DateField("fin")
    is_current = models.BooleanField("année en cours", default=False)
    is_archived = models.BooleanField("archivée", default=False)

    class Meta:
        ordering = ["-start_date"]
        constraints = [models.UniqueConstraint(fields=["school", "label"],
                                               name="uniq_school_year")]

    def save(self, *args, **kwargs):
        if self.is_current:
            SchoolYear.objects.filter(school=self.school).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.label