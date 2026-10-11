import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import ReportCard


def _fmt(value):
    return f"{value:.2f}" if value is not None else "—"


def build_report_card_pdf(report_card: ReportCard) -> bytes:
    enrollment = report_card.enrollment
    student = enrollment.student
    school = enrollment.class_room.school
    total_students = ReportCard.objects.filter(
        period=report_card.period,
        enrollment__class_room=enrollment.class_room).count()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1 * cm, bottomMargin=1 * cm)
    styles = getSampleStyleSheet()
    center = ParagraphStyle("center", parent=styles["Normal"], alignment=1)
    title = ParagraphStyle("title", parent=styles["Title"], fontSize=13)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, textColor=colors.grey)

    story = [
        Paragraph(escape(school.name), title),
        Paragraph(escape(f"{school.address} — {school.city} — Tél : {school.phone}"), small),
        Paragraph(escape(f"BULLETIN SCOLAIRE — {report_card.period.name} — "
                         f"Année {enrollment.school_year.label}").join(["<b>", "</b>"]), center),
        Spacer(1, 0.4 * cm),
    ]

    identite = [
        ["Matricule", student.matricule, "Classe", enrollment.class_room.name],
        ["Élève", f"{student.last_name} {student.first_name}", "Sexe", student.gender or "—"],
        ["Né(e) le", str(student.birth_date or "—"), "Lieu", student.birth_place or "—"],
    ]
    table_id = Table(identite, colWidths=[3 * cm, 6 * cm, 3 * cm, 5 * cm])
    table_id.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
        ("BACKGROUND", (2, 0), (2, -1), colors.whitesmoke),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    story += [table_id, Spacer(1, 0.4 * cm)]

    rows = [["Matière", "Coef.", "Moy./20", "Appréciation"]]
    for line in report_card.lines.select_related("subject"):
        rows.append([line.subject.name, _fmt(line.coefficient), _fmt(line.average),
                     line.appreciation])
    rows.append(["TOTAL", _fmt(report_card.total_coefficients), _fmt(report_card.total_points), ""])
    rows.append(["MOYENNE GÉNÉRALE", "", _fmt(report_card.average), report_card.mention])

    table = Table(rows, colWidths=[7.5 * cm, 1.7 * cm, 2.2 * cm, 5.6 * cm], repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f6f8b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 1), (2, -1), "CENTER"),
        ("BACKGROUND", (0, -2), (-1, -2), colors.HexColor("#f2f2f2")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e8f4f8")),
    ]))
    story += [table, Spacer(1, 0.4 * cm)]

    resume = [["Moyenne générale", _fmt(report_card.average)],
              ["Rang", f"{report_card.rank or '—'} / {total_students}"],
              ["Moyenne de la classe", _fmt(report_card.class_average)],
              ["Absences", str(report_card.absences_count)],
              ["Retards", str(report_card.lates_count)]]
    table_r = Table(resume, colWidths=[5 * cm, 5 * cm])
    table_r.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    story += [table_r, Spacer(1, 1 * cm)]

    signatures = Table([["Le Professeur principal", "Le Directeur"], ["", ""]],
                       colWidths=[8 * cm, 8 * cm], rowHeights=[0.6 * cm, 1.2 * cm])
    signatures.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 9),
                                    ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    story.append(signatures)

    doc.build(story)
    return buffer.getvalue()