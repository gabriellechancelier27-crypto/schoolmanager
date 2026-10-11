from django.db import models

# Create your models here.
from django.db import models
from django.utils import timezone


class Fee(models.Model):
    class Category(models.TextChoices):
        INSCRIPTION = "INSCRIPTION", "Inscription"
        SCOLARITE = "SCOLARITE", "Scolarité"
        CANTINE = "CANTINE", "Cantine"
        TRANSPORT = "TRANSPORT", "Transport"
        UNIFORME = "UNIFORME", "Uniforme"
        AUTRE = "AUTRE", "Autre"

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="fees")
    school_year = models.ForeignKey("schools.SchoolYear", on_delete=models.CASCADE, related_name="fees")
    category = models.CharField("catégorie", max_length=15, choices=Category.choices)
    label = models.CharField("libellé", max_length=100)
    amount = models.DecimalField("montant", max_digits=10, decimal_places=2)
    class_room = models.ForeignKey("academics.ClassRoom", null=True, blank=True,
                                   on_delete=models.CASCADE, related_name="fees",
                                   help_text="Vide = toutes les classes")
    due_date = models.DateField("échéance", null=True, blank=True)
    is_active = models.BooleanField("actif", default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.label} ({self.get_category_display()})"


class Payment(models.Model):
    class Method(models.TextChoices):
        ESPECES = "ESPECES", "Espèces"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        VIREMENT = "VIREMENT", "Virement"
        CHEQUE = "CHEQUE", "Chèque"

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="payments")
    receipt_number = models.CharField("n° de reçu", max_length=30, blank=True, unique=True)
    enrollment = models.ForeignKey("academics.Enrollment", on_delete=models.PROTECT,
                                   related_name="payments")
    fee = models.ForeignKey(Fee, null=True, blank=True, on_delete=models.PROTECT,
                            related_name="payments")
    amount = models.DecimalField("montant", max_digits=10, decimal_places=2)
    method = models.CharField("mode", max_length=15, choices=Method.choices, default=Method.ESPECES)
    reference = models.CharField("référence", max_length=100, blank=True,
                                 help_text="Ex. : id de transaction Mobile Money")
    paid_at = models.DateField("date de paiement", default=timezone.localdate)
    recorded_by = models.ForeignKey("core.User", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="payments_recorded")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_at", "-id"]

    def __str__(self):
        return f"{self.receipt_number} — {self.amount}"

    def save(self, *args, **kwargs):
        if not self.receipt_number:  # reçus numérotés (§4.15)
            self.receipt_number = generate_receipt_number(self.school)
        super().save(*args, **kwargs)


def generate_receipt_number(school):
    prefix = f"RC-{school.code}-"
    last = (Payment.objects.filter(school=school, receipt_number__startswith=prefix)
            .order_by("-receipt_number").first())
    try:
        sequence = int(last.receipt_number[len(prefix):]) + 1 if last else 1
    except (ValueError, TypeError):
        sequence = 1
    return f"{prefix}{sequence:05d}"


class Expense(models.Model):
    class Category(models.TextChoices):
        SALAIRES = "SALAIRES", "Salaires"
        FOURNITURES = "FOURNITURES", "Fournitures"
        EAU = "EAU", "Eau"
        ELECTRICITE = "ELECTRICITE", "Électricité"
        ENTRETIEN = "ENTRETIEN", "Entretien"
        MATERIEL = "MATERIEL", "Matériel"
        TRANSPORT = "TRANSPORT", "Transport"
        AUTRE = "AUTRE", "Autre"

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="expenses")
    school_year = models.ForeignKey("schools.SchoolYear", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="expenses")
    category = models.CharField("catégorie", max_length=15, choices=Category.choices,
                                default=Category.AUTRE)
    label = models.CharField("libellé", max_length=150)
    description = models.TextField("description", blank=True)
    amount = models.DecimalField("montant", max_digits=10, decimal_places=2)
    date = models.DateField("date", default=timezone.localdate)
    recorded_by = models.ForeignKey("core.User", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="expenses_recorded")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return self.label