import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_receipt_pdf(payment) -> bytes:
    school = payment.school
    student = payment.enrollment.student
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A5, topMargin=1 * cm, bottomMargin=0.8 * cm)
    styles = getSampleStyleSheet()
    center = ParagraphStyle("center", parent=styles["Normal"], alignment=1)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=7,
                           textColor=colors.grey, alignment=1)

    rows = [
        ["N° de reçu", payment.receipt_number],
        ["Date", str(payment.paid_at)],
        ["Élève", f"{student.last_name} {student.first_name} ({student.matricule})"],
        ["Classe", payment.enrollment.class_room.name],
        ["Année scolaire", payment.enrollment.school_year.label],
        ["Frais", str(payment.fee) if payment.fee else "—"],
        ["Mode de paiement", payment.get_method_display()],
        ["Référence", payment.reference or "—"],
        ["Montant payé", f"{payment.amount:,.0f} {school.currency}".replace(",", " ")],
    ]
    table = Table(rows, colWidths=[4.5 * cm, 8 * cm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f5f5f5")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e8f4f8")),
    ]))

    story = [
        Paragraph(f"<b>{escape(school.name)}</b>", center),
        Paragraph(escape(f"{school.address or ''} — {school.city or ''} — Tél : {school.phone or ''}"),
                  small),
        Paragraph("REÇU DE PAIEMENT", ParagraphStyle("h", parent=styles["Heading2"], alignment=1)),
        Spacer(1, 0.3 * cm), table, Spacer(1, 0.5 * cm),
        Paragraph("Signature / Cachet : ____________________", center),
        Paragraph("Ce reçu fait foi de paiement. À conserver.", small),
    ]
    doc.build(story)
    return buffer.getvalue()