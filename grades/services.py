from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from rest_framework.exceptions import ValidationError

from academics.models import Enrollment, TeachingAssignment
from attendance.models import Attendance
from communication.services import notify_student

from .averages import semester_average, split_grades
from .models import Grade, ReportCard, ReportCardLine

CENT = Decimal("0.01")


def mention_for(average, pass_mark) -> str:
    if average >= 16:
        return "Très bien"
    if average >= 14:
        return "Bien"
    if average >= 12:
        return "Assez bien"
    if average >= pass_mark:
        return "Passable"
    return "Insuffisant"


def subject_average(enrollment, subject, period):
    """Moyenne d'une matière = (moyenne des devoirs + note de composition) / 2."""
    grades = list(Grade.objects.filter(enrollment=enrollment, subject=subject, period=period))
    return semester_average(*split_grades(grades))


@transaction.atomic
def compute_class_report_cards(*, class_room, period):
    """Moyennes, mentions, classement, bulletins d'une classe (§4.10, §4.11, §5.2)."""
    if period.is_locked:
        raise ValidationError({"detail": "Les résultats de cette période sont verrouillés."})

    school_year = period.school_year
    assignments = TeachingAssignment.objects.filter(school_year=school_year,
                                                    class_room=class_room).select_related("subject")
    enrollments = list(
        Enrollment.objects.filter(school_year=school_year, class_room=class_room,
                                  status=Enrollment.Status.ACTIVE)
        .select_related("student", "class_room"))
    pass_mark = class_room.school.pass_mark

    results = []
    for enrollment in enrollments:
        lines = []
        for assignment in assignments:
            average = subject_average(enrollment, assignment.subject, period)
            if average is not None:
                lines.append((assignment, average))
        if not lines:
            continue
        total_points = sum((avg * a.coefficient for a, avg in lines), Decimal("0"))
        total_coef = sum((a.coefficient for a, _ in lines), Decimal("0"))
        general = (total_points / total_coef).quantize(CENT, rounding=ROUND_HALF_UP)
        results.append({"enrollment": enrollment, "lines": lines,
                        "total_points": total_points, "total_coefficients": total_coef,
                        "average": general})

    results.sort(key=lambda item: item["average"], reverse=True)  # classement
    averages = [r["average"] for r in results]
    class_average = ((sum(averages, Decimal("0")) / len(averages))
                     .quantize(CENT, rounding=ROUND_HALF_UP)) if averages else None
    success = sum(1 for a in averages if a >= pass_mark)

    for rank, result in enumerate(results, start=1):
        enrollment = result["enrollment"]
        base = {"student": enrollment.student, "class_room": class_room,
                "date__gte": period.start_date, "date__lte": period.end_date}
        absences = Attendance.objects.filter(status=Attendance.Status.ABSENT, **base).count()
        lates = Attendance.objects.filter(status=Attendance.Status.LATE, **base).count()

        report_card, _ = ReportCard.objects.update_or_create(
            enrollment=enrollment, period=period,
            defaults={"total_points": result["total_points"],
                      "total_coefficients": result["total_coefficients"],
                      "average": result["average"], "class_average": class_average,
                      "rank": rank, "mention": mention_for(result["average"], pass_mark),
                      "absences_count": absences, "lates_count": lates})
        ReportCardLine.objects.filter(report_card=report_card).delete()
        ReportCardLine.objects.bulk_create([
            ReportCardLine(report_card=report_card, subject=assignment.subject,
                           coefficient=assignment.coefficient, average=average,
                           appreciation=mention_for(average, pass_mark))
            for assignment, average in result["lines"]])
        notify_student(enrollment.student, "Bulletin disponible",
                       f"Le bulletin de {period.name} est disponible "
                       f"({result['average']}/20, rang {rank}).",
                       link=f"/api/report-cards/{report_card.id}/")

    best = results[0] if results else None
    return {"classe": class_room.name, "periode": period.name,
            "effectif_evalue": len(results), "moyenne_de_classe": class_average,
            "meilleur_eleve": str(best["enrollment"].student) if best else None,
            "meilleure_moyenne": best["average"] if best else None,
            "taux_de_reussite": round(success / len(averages) * 100, 1) if averages else None}
