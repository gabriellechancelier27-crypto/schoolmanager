from django.db import models

# Create your models here.
from django.db import models
from django.utils import timezone


class Teacher(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Actif"
        INACTIVE = "INACTIVE", "Inactif"

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="teachers")
    user = models.OneToOneField("core.User", null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="teacher_profile")
    matricule = models.CharField("matricule", max_length=30, blank=True)
    first_name = models.CharField("prénom", max_length=100)
    last_name = models.CharField("nom", max_length=100)
    gender = models.CharField("sexe", max_length=1, blank=True,
                              choices=[("M", "Masculin"), ("F", "Féminin")])
    phone = models.CharField("téléphone", max_length=30, blank=True)
    email = models.EmailField("email", blank=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    status = models.CharField("statut", max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        constraints = [models.UniqueConstraint(fields=["school", "matricule"],
                                               name="uniq_teacher_matricule")]

    def __str__(self):
        return f"{self.last_name} {self.first_name}"

    def save(self, *args, **kwargs):
        if not self.matricule:
            last = (Teacher.objects.filter(school=self.school).exclude(matricule="")
                    .order_by("-matricule").values_list("matricule", flat=True).first())
            try:
                seq = int(last.split("-")[-1]) + 1 if last else 1
            except ValueError:
                seq = 1
            self.matricule = f"ENS-{seq:03d}"
        super().save(*args, **kwargs)


class Parent(models.Model):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="parents")
    user = models.OneToOneField("core.User", null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="parent_profile")
    first_name = models.CharField("prénom", max_length=100)
    last_name = models.CharField("nom", max_length=100)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    email = models.EmailField("email", blank=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    profession = models.CharField("profession", max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.last_name} {self.first_name}"

    @property
    def children(self):
        return Student.objects.filter(student_parents__parent=self)


class Student(models.Model):
    class Gender(models.TextChoices):
        M = "M", "Masculin"
        F = "F", "Féminin"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Actif"
        INACTIVE = "INACTIVE", "Inactif"
        GRADUATED = "GRADUATED", "Diplômé"
        TRANSFERRED = "TRANSFERRED", "Transféré"

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="students")
    user = models.OneToOneField("core.User", null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="student_profile")
    matricule = models.CharField("matricule", max_length=30, blank=True)
    first_name = models.CharField("prénom", max_length=100)
    last_name = models.CharField("nom", max_length=100)
    gender = models.CharField("sexe", max_length=1, choices=Gender.choices)
    birth_date = models.DateField("date de naissance", null=True, blank=True)
    birth_place = models.CharField("lieu de naissance", max_length=100, blank=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    photo = models.ImageField("photo", upload_to="students/photos/", null=True, blank=True)
    status = models.CharField("statut", max_length=15, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        constraints = [models.UniqueConstraint(fields=["school", "matricule"],
                                               name="uniq_student_matricule")]

    def __str__(self):
        return f"{self.last_name} {self.first_name}"

    def save(self, *args, **kwargs):
        if not self.matricule:  # génération automatique du matricule (§4.8)
            year = timezone.localdate().year
            prefix = f"{self.school.code}-{year}-"
            last = (Student.objects.filter(school=self.school, matricule__startswith=prefix)
                    .order_by("-matricule").values_list("matricule", flat=True).first())
            try:
                seq = int(last[len(prefix):]) + 1 if last else 1
            except ValueError:
                seq = 1
            self.matricule = f"{prefix}{seq:04d}"
        super().save(*args, **kwargs)

    @property
    def current_enrollment(self):
        return (self.enrollments.filter(status=Enrollment.Status.ACTIVE,
                school_year__is_current=True)
                .select_related("class_room", "school_year").first())

    @property
    def current_class_name(self):
        enrollment = self.current_enrollment
        return enrollment.class_room.name if enrollment else None


class StudentParent(models.Model):
    class Relation(models.TextChoices):
        PERE = "PERE", "Père"
        MERE = "MERE", "Mère"
        TUTEUR = "TUTEUR", "Tuteur / Tutrice"
        AUTRE = "AUTRE", "Autre"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="student_parents")
    parent = models.ForeignKey(Parent, on_delete=models.CASCADE, related_name="student_parents")
    relation = models.CharField("relation", max_length=10, choices=Relation.choices,
                                default=Relation.TUTEUR)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["student", "parent"],
                                               name="uniq_student_parent")]


class ClassRoom(models.Model):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="class_rooms")
    name = models.CharField("nom", max_length=50, help_text="Ex. : 6ème A")
    level = models.CharField("niveau", max_length=50, blank=True)
    serie = models.CharField("série", max_length=50, blank=True)
    capacity = models.PositiveIntegerField("capacité", default=60)
    main_teacher = models.ForeignKey(Teacher, null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name="headed_classes", verbose_name="professeur principal")
    is_active = models.BooleanField("active", default=True)

    class Meta:
        ordering = ["level", "name"]
        verbose_name = "classe"
        constraints = [models.UniqueConstraint(fields=["school", "name"],
                                               name="uniq_classroom")]

    def __str__(self):
        return self.name


class Subject(models.Model):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField("nom", max_length=100)
    code = models.CharField("code", max_length=20, blank=True)
    default_coefficient = models.DecimalField("coefficient par défaut", max_digits=4,
                                              decimal_places=1, default=1)

    class Meta:
        ordering = ["name"]
        verbose_name = "matière"
        constraints = [models.UniqueConstraint(fields=["school", "name"],
                                               name="uniq_subject")]

    def __str__(self):
        return self.name


class TeachingAssignment(models.Model):
    """Affectation enseignant → matière + classe, avec coefficient (§4.4/§4.6)."""
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="assignments")
    school_year = models.ForeignKey("schools.SchoolYear", on_delete=models.CASCADE, related_name="assignments")
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name="assignments")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="assignments")
    class_room = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name="assignments")
    coefficient = models.DecimalField("coefficient", max_digits=4, decimal_places=1, default=1)

    class Meta:
        ordering = ["class_room__name", "subject__name"]
        constraints = [models.UniqueConstraint(
            fields=["school_year", "teacher", "subject", "class_room"], name="uniq_assignment")]

    def __str__(self):
        return f"{self.teacher} — {self.subject} — {self.class_room}"


class Enrollment(models.Model):
    """Inscription d'un élève dans une classe pour une année (§4.8)."""
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        CANCELLED = "CANCELLED", "Annulée"
        TRANSFERRED = "TRANSFERRED", "Transfert"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="enrollments")
    class_room = models.ForeignKey(ClassRoom, on_delete=models.PROTECT, related_name="enrollments")
    school_year = models.ForeignKey("schools.SchoolYear", on_delete=models.PROTECT,
                                    related_name="enrollments")
    date = models.DateField("date d'inscription", default=timezone.localdate)
    status = models.CharField("statut", max_length=12, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        constraints = [models.UniqueConstraint(fields=["student", "school_year"],
                                               name="uniq_enrollment_per_year")]

    def __str__(self):
        return f"{self.student} → {self.class_room} ({self.school_year})"