"""Collecte des données d'un bulletin, au format du bulletin scolaire togolais.

Les barèmes d'appréciation ci-dessous sont à adapter au barème officiel de l'établissement.
"""
import re
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Max, Min

from academics.models import Enrollment, TeachingAssignment

from .models import Grade, ReportCardLine

CENT = Decimal("0.01")
COMPOSITION = "COMPOSITION"

# (seuil minimum, libellé) : du plus haut au plus bas
SUBJECT_SCALE = [
    (16, "Très bien"), (14, "Bien"), (12, "Assez-bien"),
    (10, "Passable"), (7, "Insuffisant"), (0, "Très insuffisant"),
]
GENERAL_SCALE = [
    (16, "Très bon travail"), (14, "Bon travail"), (12, "Assez-bon travail"),
    (10, "Travail passable"), (7, "Travail insuffisant"), (0, "Travail très insuffisant"),
]

# Ordre d'affichage et titres des groupes de matières
GROUPS = [
    ("LITTERAIRE", "Matières Littéraires"),
    ("SCIENTIFIQUE", "Matières Scientifiques"),
    ("AUTRE", ""),   # EPS, etc. : lignes isolées, sans titre ni sous-total
]


def scale_label(value, scale):
    v = float(value)
    for threshold, label in scale:
        if v >= threshold:
            return label
    return scale[-1][1]


# ---------- Moyenne écrite en lettres ----------
_UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
          "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
          "dix-sept", "dix-huit", "dix-neuf"]
_TENS = {2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante"}


def fr_number(n):
    """Nombre de 0 à 99 en toutes lettres."""
    if n < 20:
        return _UNITS[n]
    if n < 70:
        tens, unit = divmod(n, 10)
        base = _TENS[tens]
        if unit == 0:
            return base
        return f"{base} et un" if unit == 1 else f"{base} {_UNITS[unit]}"
    if n < 80:
        return "soixante et onze" if n == 71 else f"soixante {_UNITS[n - 60]}"
    if n == 80:
        return "quatre-vingts"
    return f"quatre-vingt {_UNITS[n - 80]}"


def average_in_words(value):
    """12.61 → « douze virgule soixante et un »."""
    value = Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)
    whole = int(value)
    frac = int((value - whole) * 100)
    text = fr_number(whole) if whole <= 99 else str(whole)
    if frac:
        text += " virgule " + ("zéro " if frac < 10 else "") + fr_number(frac)
    return text


def ordinal(n):
    return "1er(e)" if n == 1 else f"{n}ème"


def fmt_name(first, last):
    """GABA Kokou Gabriel : NOM en majuscules, prénoms en capitales initiales."""
    return f"{(last or '').upper()} {(first or '').title()}".strip()


def period_title(name):
    m = re.match(r"(?i)^\s*(trimestre|semestre)\s*(\d+)\s*$", name or "")
    if m:
        n = int(m.group(2))
        return f"BULLETIN DU {n}{'er' if n == 1 else 'ème'} {m.group(1).upper()}"
    return f"BULLETIN : {(name or '').upper()}"


def _weighted(grades):
    total = Decimal("0")
    weight = Decimal("0")
    for g in grades:
        total += g.value * g.coefficient
        weight += g.coefficient
    if weight == 0:
        return None
    return (total / weight).quantize(CENT, rounding=ROUND_HALF_UP)


def _group_totals(rows):
    coef = sum((r["coef"] for r in rows), Decimal("0"))
    points = sum((r["points"] for r in rows), Decimal("0"))
    average = (points / coef).quantize(CENT, rounding=ROUND_HALF_UP) if coef else None
    return {"coef": coef, "points": points, "average": average}


def build_bulletin_context(report_card):
    """Rassemble tout ce qu'il faut pour dessiner le bulletin d'un élève."""
    enrollment = report_card.enrollment
    student = enrollment.student
    class_room = enrollment.class_room
    school = class_room.school
    period = report_card.period
    year = enrollment.school_year

    assignments = {a.subject_id: a for a in TeachingAssignment.objects
                   .filter(school_year=year, class_room=class_room).select_related("teacher")}

    grades_by_subject = {}
    for grade in Grade.objects.filter(enrollment=enrollment, period=period):
        grades_by_subject.setdefault(grade.subject_id, []).append(grade)

    by_group = {key: [] for key, _ in GROUPS}
    # Ordre des matières = ordre de création dans la page « Matières »
    for line in report_card.lines.select_related("subject").order_by("subject_id"):
        subject = line.subject
        grades = grades_by_subject.get(subject.id, [])
        higher = ReportCardLine.objects.filter(
            report_card__period=period, report_card__enrollment__class_room=class_room,
            subject=subject, average__gt=line.average).count()
        assignment = assignments.get(subject.id)
        row = {
            "name": subject.name,
            "continuous": _weighted([g for g in grades if g.assessment_type != COMPOSITION]),
            "composition": _weighted([g for g in grades if g.assessment_type == COMPOSITION]),
            "average": line.average,
            "coef": line.coefficient,
            "points": (line.average * line.coefficient).quantize(CENT, rounding=ROUND_HALF_UP),
            "rank": higher + 1,
            "appreciation": scale_label(line.average, SUBJECT_SCALE),
            "teacher": assignment.teacher.last_name.upper() if assignment else "",
        }
        key = subject.category if subject.category in by_group else "AUTRE"
        by_group[key].append(row)

    groups = []
    all_rows = []
    for key, title in GROUPS:
        rows = by_group[key]
        if not rows:
            continue
        all_rows += rows
        groups.append({"key": key, "title": title, "rows": rows,
                       "totals": _group_totals(rows) if title else None})
    total_a = _group_totals(all_rows)

    stats = (type(report_card).objects
             .filter(period=period, enrollment__class_room=class_room, average__isnull=False)
             .aggregate(low=Min("average"), high=Max("average")))
    effectif = Enrollment.objects.filter(school_year=year, class_room=class_room,
                                         status=Enrollment.Status.ACTIVE).count()
    director = school.users.filter(role="DIRECTOR", is_active=True).order_by("id").first()
    head_teacher = class_room.main_teacher
    average = report_card.average

    return {
        "school": school,
        "ministry": "MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE ET SECONDAIRE",
        "republic": "RÉPUBLIQUE TOGOLAISE",
        "motto": "Travail-Liberté-Patrie",
        "title": period_title(period.name),
        "year": year.label,
        "student_name": fmt_name(student.first_name, student.last_name),
        "gender": student.gender or "",
        "admission_code": student.admission_code or "",
        "class_name": class_room.name,
        "effectif": effectif,
        "matricule": student.matricule,
        "groups": groups,
        "total_a": total_a,
        "average": average,
        "average_words": average_in_words(average) if average is not None else "",
        "rank": report_card.rank,
        "general_label": scale_label(average, GENERAL_SCALE) if average is not None else "",
        "low": stats["low"],
        "high": stats["high"],
        "class_average": report_card.class_average,
        "absences": report_card.absences_count,
        "lates": report_card.lates_count,
        "head_teacher": fmt_name(head_teacher.first_name, head_teacher.last_name) if head_teacher else "",
        "principal_title": "Proviseur",
        "principal": fmt_name(director.first_name, director.last_name) if director else "",
        "city": school.city,
    }
