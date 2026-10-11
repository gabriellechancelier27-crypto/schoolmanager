import random
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand

from academics.models import (ClassRoom, Enrollment, Parent, Student, StudentParent,
                              Subject, Teacher, TeachingAssignment)
from attendance.models import Attendance
from finance.models import Expense, Fee, Payment
from grades.models import Grade, Period
from grades.services import compute_class_report_cards
from schools.models import School, SchoolYear

User = get_user_model()
PASSWORD = "demo1234"
PRENOMS = ["Kossi", "Awa", "Yao", "Akouvi", "Koffi", "Afi", "Komlan", "Essohana", "Abra", "Sena"]
NOMS = ["Mensah", "Kpodar", "Agbeko", "Tettey", "Amégan", "Lawson", "Adjovi", "Kountché", "Sowi"]


class Command(BaseCommand):
    help = "Jeu de données de démonstration : établissement, comptes, classes, notes, finances."

    def handle(self, *args, **options):
        call_command("flush", interactive=False)  # ATTENTION : vide toute la base

        school = School.objects.create(
            name="Lycée Démonstration de Lomé", code="LYCDEM",
            address="Bè-Kpota, Rue 12", city="Lomé",
            phone="+228 22 00 00 00", email="contact@lycdem.tg")

        year = SchoolYear.objects.create(school=school, label="2025-2026",
                                         start_date=date(2025, 9, 15),
                                         end_date=date(2026, 7, 10), is_current=True)
        periods = [
            Period.objects.create(school=school, school_year=year, name="Trimestre 1",
                                  order=1, start_date=date(2025, 9, 15), end_date=date(2025, 12, 12)),
            Period.objects.create(school=school, school_year=year, name="Trimestre 2",
                                  order=2, start_date=date(2026, 1, 5), end_date=date(2026, 3, 27)),
            Period.objects.create(school=school, school_year=year, name="Trimestre 3",
                                  order=3, start_date=date(2026, 4, 6), end_date=date(2026, 7, 3)),
        ]
        trimestre1 = periods[0]

        def create_user(username, role, first_name, last_name, **extra):
            return User.objects.create_user(username=username, password=PASSWORD, role=role,
                                            first_name=first_name, last_name=last_name,
                                            school=school, **extra)

        User.objects.create_user(username="superadmin", password=PASSWORD, role="SUPER_ADMIN",
                                 first_name="Super", last_name="Admin",
                                 is_superuser=True, is_staff=True)
        create_user("admin", "SCHOOL_ADMIN", "Awa", "Bakary")
        create_user("directeur", "DIRECTOR", "Kossi", "Adjo")
        comptable = create_user("comptable", "ACCOUNTANT", "Fifi", "Kpodjélo")

        teacher_users = {
            "maths": create_user("prof_maths", "TEACHER", "Jean", "Mensah"),
            "francais": create_user("prof_francais", "TEACHER", "Abla", "Segboya"),
            "autres": create_user("prof_svt", "TEACHER", "Koffi", "Attiogbé"),
        }
        teachers = {key: Teacher.objects.create(
                        school=school, user=user, first_name=user.first_name,
                        last_name=user.last_name, phone=f"+228 91 00 0{i} 0")
                    for i, (key, user) in enumerate(teacher_users.items(), start=1)}

        classes = [
            ClassRoom.objects.create(school=school, name="6ème A", level="6ème",
                                     main_teacher=teachers["maths"]),
            ClassRoom.objects.create(school=school, name="6ème B", level="6ème",
                                     main_teacher=teachers["francais"]),
            ClassRoom.objects.create(school=school, name="5ème A", level="5ème",
                                     main_teacher=teachers["autres"]),
        ]
        subject_specs = [
            ("Mathématiques", "MATH", Decimal("4"), "maths"),
            ("Français", "FRAN", Decimal("4"), "francais"),
            ("Anglais", "ANGL", Decimal("2"), "autres"),
            ("SVT", "SVTE", Decimal("2"), "autres"),
            ("Histoire-Géographie", "HIGE", Decimal("2"), "autres"),
            ("EPS", "EPS", Decimal("1"), "autres"),
        ]
        for name, code, coef, key in subject_specs:
            subject = Subject.objects.create(school=school, name=name, code=code,
                                             default_coefficient=coef)
            for class_room in classes:
                TeachingAssignment.objects.create(school=school, school_year=year,
                                                  teacher=teachers[key], subject=subject,
                                                  class_room=class_room, coefficient=coef)

        parents = [Parent.objects.create(
            school=school, first_name=random.choice(PRENOMS), last_name=random.choice(NOMS),
            phone=f"+228 90 {i:02d} {random.randint(10, 99)} {random.randint(10, 99)}",
            profession=random.choice(["Commerçante", "Fonctionnaire", "Artisan", "Infirmière"]))
            for i in range(1, 11)]

        enrollments = []
        for i in range(30):
            student = Student.objects.create(
                school=school, first_name=random.choice(PRENOMS), last_name=random.choice(NOMS),
                gender=random.choice(["M", "F"]),
                birth_date=date(2013, random.randint(1, 12), random.randint(1, 28)),
                birth_place=random.choice(["Lomé", "Kara", "Atakpamé", "Dapaong", "Aného"]))
            StudentParent.objects.create(student=student, parent=parents[i % 10], relation="TUTEUR")
            enrollments.append(Enrollment.objects.create(student=student,
                                                         class_room=classes[i % 3],
                                                         school_year=year))

        # Comptes de démonstration parent / élève
        demo_parent = parents[0]
        demo_parent.user = create_user("parent1", "PARENT", demo_parent.first_name,
                                       demo_parent.last_name)
        demo_parent.save()
        demo_student = enrollments[0].student
        demo_student.user = create_user("eleve1", "STUDENT", demo_student.first_name,
                                        demo_student.last_name)
        demo_student.save()

        # Notes du trimestre 1 (devoir coef 1 + composition coef 2)
        for enrollment in enrollments:
            assignments = TeachingAssignment.objects.filter(school_year=year,
                           class_room=enrollment.class_room).select_related("subject")
            for assignment in assignments:
                Grade.objects.create(enrollment=enrollment, subject=assignment.subject,
                                     period=trimestre1, assessment_type="DEVOIR", sequence=1,
                                     coefficient=Decimal("1"),
                                     value=Decimal(str(round(random.uniform(5, 18), 2))))
                Grade.objects.create(enrollment=enrollment, subject=assignment.subject,
                                     period=trimestre1, assessment_type="COMPOSITION", sequence=1,
                                     coefficient=Decimal("2"),
                                     value=Decimal(str(round(random.uniform(4, 19), 2))))

        # Absences
        subject_list = [Subject.objects.get(school=school, code=code)
                        for _, code, _, _ in subject_specs]
        for enrollment in enrollments[:10]:
            Attendance.objects.create(
                student=enrollment.student, class_room=enrollment.class_room, school_year=year,
                subject=random.choice(subject_list),
                date=date(2025, random.choice([10, 11]), random.randint(1, 28)),
                status=random.choice(["ABSENT", "LATE", "EXCUSED"]),
                minutes_late=random.randint(5, 25) if random.random() < 0.5 else 0,
                reason=random.choice(["Maladie", "Retard transport", "Raison familiale", ""]),
                recorded_by=comptable)

        # Finances
        fee_inscription = Fee.objects.create(school=school, school_year=year,
                                             category="INSCRIPTION",
                                             label="Inscription 2025-2026",
                                             amount=Decimal("15000"))
        Fee.objects.create(school=school, school_year=year, category="SCOLARITE",
                           label="Scolarité annuelle", amount=Decimal("120000"))
        Fee.objects.create(school=school, school_year=year, category="CANTINE",
                           label="Cantine annuelle", amount=Decimal("45000"),
                           class_room=classes[0])
        for enrollment in enrollments:
            amount = random.choice([0, 15000, 50000, 120000, 165000])
            if amount:
                Payment.objects.create(
                    school=school, enrollment=enrollment, fee=fee_inscription,
                    amount=Decimal(amount),
                    method=random.choice(["ESPECES", "MOBILE_MONEY", "VIREMENT"]),
                    reference=f"TX{random.randint(100000, 999999)}" if random.random() < 0.5 else "",
                    paid_at=date(2025, random.randint(10, 12), random.randint(1, 28)),
                    recorded_by=comptable)
        Expense.objects.create(school=school, school_year=year, category="ELECTRICITE",
                               label="Facture CEET — octobre", amount=Decimal("85000"),
                               date=date(2025, 10, 31), recorded_by=comptable)
        Expense.objects.create(school=school, school_year=year, category="FOURNITURES",
                               label="Craies, registres et papier", amount=Decimal("32000"),
                               date=date(2025, 9, 25), recorded_by=comptable)

        # Bulletins du trimestre 1
        for class_room in classes:
            stats = compute_class_report_cards(class_room=class_room, period=trimestre1)
            self.stdout.write(
                f"  {class_room} — moyenne : {stats['moyenne_de_classe']}, "
                f"réussite : {stats['taux_de_reussite']}%")

        self.stdout.write(self.style.SUCCESS(
            f"Données créées. Comptes (mot de passe : {PASSWORD}) : superadmin, admin, "
            "directeur, comptable, prof_maths, prof_francais, prof_svt, parent1, eleve1"))