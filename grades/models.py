from django.db import models

# Create your models here.
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Period(models.Model):
    """Trimestre ou semestre d'une année scolaire."""
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="periods")
    school_year = models.ForeignKey("schools.SchoolYear", on_delete=models.CASCADE, related_name="periods")
    name = models.CharField("nom", max_length=50)
    order = models.PositiveSmallIntegerField("ordre")
    start_date = models.DateField("début")
    end_date = models.DateField("fin")
    is_locked = models.BooleanField("résultats verrouillés", default=False)

    class Meta:
        ordering = ["order"]
        constraints = [models.UniqueConstraint(fields=["school_year", "name"],
                                               name="uniq_period")]

    def __str__(self):
        return f"{self.name} ({self.school_year})"


class Grade(models.Model):
    class AssessmentType(models.TextChoices):
        DEVOIR = "DEVOIR", "Devoir"
        COMPOSITION = "COMPOSITION", "Composition"
        INTERROGATION = "INTERROGATION", "Interrogation"
        PRATIQUE = "PRATIQUE", "Pratique"

    enrollment = models.ForeignKey("academics.Enrollment", on_delete=models.CASCADE,
                                   related_name="grades")
    subject = models.ForeignKey("academics.Subject", on_delete=models.CASCADE, related_name="grades")
    period = models.ForeignKey(Period, on_delete=models.CASCADE, related_name="grades")
    assessment_type = models.CharField("type", max_length=15, choices=AssessmentType.choices,
                                       default=AssessmentType.DEVOIR)
    sequence = models.PositiveSmallIntegerField("n° d'évaluation", default=1)
    value = models.DecimalField("note", max_digits=5, decimal_places=2,
                                validators=[MinValueValidator(0), MaxValueValidator(20)])
    coefficient = models.DecimalField("pondération", max_digits=3, decimal_places=1, default=1)
    teacher = models.ForeignKey("academics.Teacher", null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="grades_given")
    created_by = models.ForeignKey("core.User", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="grades_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["period", "subject", "assessment_type", "sequence"]
        constraints = [models.UniqueConstraint(
            fields=["enrollment", "subject", "period", "assessment_type", "sequence"],
            name="uniq_grade")]

    def __str__(self):
        return f"{self.enrollment.student} {self.subject} {self.value}"


class ReportCard(models.Model):
    """Bulletin d'un élève pour une période (§4.10)."""
    enrollment = models.ForeignKey("academics.Enrollment", on_delete=models.CASCADE,
                                   related_name="report_cards")
    period = models.ForeignKey(Period, on_delete=models.CASCADE, related_name="report_cards")
    total_points = models.DecimalField("total points", max_digits=8, decimal_places=2, null=True)
    total_coefficients = models.DecimalField("total coefficients", max_digits=6,
                                             decimal_places=1, null=True)
    average = models.DecimalField("moyenne générale", max_digits=5, decimal_places=2, null=True)
    class_average = models.DecimalField("moyenne de classe", max_digits=5, decimal_places=2, null=True)
    rank = models.PositiveIntegerField("rang", null=True)
    mention = models.CharField("mention", max_length=30, blank=True)
    absences_count = models.PositiveIntegerField("absences", default=0)
    lates_count = models.PositiveIntegerField("retards", default=0)
    is_validated = models.BooleanField("validé", default=False)
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["period", "rank"]
        constraints = [models.UniqueConstraint(fields=["enrollment", "period"],
                                               name="uniq_report_card")]

    def __str__(self):
        return f"Bulletin {self.enrollment.student} — {self.period.name}"


class ReportCardLine(models.Model):
    report_card = models.ForeignKey(ReportCard, on_delete=models.CASCADE, related_name="lines")
    subject = models.ForeignKey("academics.Subject", on_delete=models.CASCADE, related_name="+")
    coefficient = models.DecimalField("coefficient", max_digits=4, decimal_places=1)
    average = models.DecimalField("moyenne matière", max_digits=5, decimal_places=2)
    appreciation = models.CharField("appréciation", max_length=50, blank=True)

    class Meta:
        ordering = ["subject__name"]
        constraints = [models.UniqueConstraint(fields=["report_card", "subject"],
                                               name="uniq_report_line")]