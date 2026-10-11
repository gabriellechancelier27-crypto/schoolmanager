from django.db import models

# Create your models here.
from django.db import models
from django.utils import timezone


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Présent"
        ABSENT = "ABSENT", "Absent"
        LATE = "LATE", "Retard"
        EXCUSED = "EXCUSED", "Absence justifiée"

    student = models.ForeignKey("academics.Student", on_delete=models.CASCADE,
                                related_name="attendances")
    class_room = models.ForeignKey("academics.ClassRoom", on_delete=models.CASCADE,
                                   related_name="attendances")
    school_year = models.ForeignKey("schools.SchoolYear", on_delete=models.CASCADE,
                                    related_name="attendances")
    subject = models.ForeignKey("academics.Subject", null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="attendances")
    date = models.DateField("date", default=timezone.localdate)
    start_time = models.TimeField("heure", null=True, blank=True)
    status = models.CharField("statut", max_length=10, choices=Status.choices,
                              default=Status.PRESENT)
    minutes_late = models.PositiveSmallIntegerField("retard (min)", default=0)
    reason = models.CharField("motif", max_length=255, blank=True)
    recorded_by = models.ForeignKey("core.User", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="attendances_recorded")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "student__last_name"]
        verbose_name = "présence"

    def __str__(self):
        return f"{self.student} — {self.date} — {self.get_status_display()}"