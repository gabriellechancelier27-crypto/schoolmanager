from django.db import models

# Create your models here.
from django.db import models


class Announcement(models.Model):
    class Target(models.TextChoices):
        ALL = "ALL", "Tous"
        CLASS = "CLASS", "Classe"
        ROLE = "ROLE", "Rôle"

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE,
                               related_name="announcements")
    title = models.CharField("titre", max_length=200)
    body = models.TextField("contenu")
    author = models.ForeignKey("core.User", null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="announcements")
    target = models.CharField("destinataires", max_length=10, choices=Target.choices,
                              default=Target.ALL)
    class_room = models.ForeignKey("academics.ClassRoom", null=True, blank=True,
                                   on_delete=models.CASCADE, related_name="announcements")
    role = models.CharField("rôle ciblé", max_length=20, blank=True)
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-published_at"]

    def __str__(self):
        return self.title


class Notification(models.Model):
    user = models.ForeignKey("core.User", on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField("titre", max_length=200)
    message = models.TextField("message")
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField("lue", default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title