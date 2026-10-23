"""Bulletin scolaire en PDF, au format du bulletin togolais.

Filigrane : déposez l'image du blason de la République togolaise (les deux lions) dans
grades/assets/ sous le nom blason.png (ou .jpg / .jpeg / .webp). Sans image, un monogramme
« RT » discret est dessiné à la place.
"""
import io
from datetime import date
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageOps
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from .bulletin import build_bulletin_context, ordinal
from .models import ReportCard

ASSETS = Path(__file__).resolve().parent / "assets"
WATERMARK_STRENGTH = 0.12      # opacité du filigrane (0 = invisible, 1 = plein)
WATERMARK_SIZE = 400           # taille du blason, en points
WATERMARK_CENTER_FROM_TOP = 430

W, H = A4
LM = 24
RM = W - 24
CW = RM - LM
INK = (0.10, 0.10, 0.12)
GREY = (0.45, 0.45, 0.50)
LINE = (0.30, 0.30, 0.35)

# Largeurs des colonnes (total = CW)
COLS = [152, 36, 36, 42, 30, 46, 44, 74, 87]
XS = [LM]
for _w in COLS:
    XS.append(XS[-1] + _w)


def Y(t):
    """Distance depuis le haut de la page → ordonnée PDF."""
    return H - t


# ---------------------------------------------------------------- filigrane
@lru_cache(maxsize=1)
def _watermark():
    for name in ("blason.png", "blason.jpg", "blason.jpeg", "blason.webp"):
        path = ASSETS / name
        if not path.exists():
            continue
        try:
            img = Image.open(path).convert("RGBA")
            img.thumbnail((900, 900))
            alpha = img.getchannel("A")
            dark = ImageOps.grayscale(img.convert("RGB")).point(lambda v: 255 - v)
            if alpha.getextrema()[0] == 255:          # image sans transparence : fond blanc ignoré
                mask = dark
            else:                                      # fond transparent : silhouette + détails
                mask = ImageChops.multiply(alpha, dark.point(lambda v: 90 + int(v * 165 / 255)))
            mask = mask.point(lambda v: int(v * WATERMARK_STRENGTH))
            tint = Image.new("RGBA", img.size, (92, 82, 108, 0))
            tint.putalpha(mask)
            return ImageReader(tint)
        except Exception:
            return None
    return None


def _draw_watermark(c):
    image = _watermark()
    cx, cy = W / 2, Y(WATERMARK_CENTER_FROM_TOP)
    if image is not None:
        s = WATERMARK_SIZE
        c.drawImage(image, cx - s / 2, cy - s / 2, width=s, height=s,
                    preserveAspectRatio=True, anchor="c", mask="auto")
        return
    c.saveState()
    c.setStrokeColorRGB(0.36, 0.32, 0.42)
    c.setFillColorRGB(0.36, 0.32, 0.42)
    c.setStrokeAlpha(0.10)
    c.setFillAlpha(0.08)
    c.setLineWidth(4)
    c.circle(cx, cy, 150, stroke=1, fill=0)
    c.setLineWidth(1.5)
    c.circle(cx, cy, 136, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 120)
    c.drawCentredString(cx, cy - 40, "RT")
    c.restoreState()


# ---------------------------------------------------------------- outils
def ink(c, rgb=INK):
    c.setFillColorRGB(*rgb)


def box(c, x, t, w, h, r=5, lw=0.7):
    c.setStrokeColorRGB(*LINE)
    c.setLineWidth(lw)
    c.roundRect(x, Y(t) - h, w, h, r, stroke=1, fill=0)


def vline(c, x, t, h, lw=0.4):
    c.setStrokeColorRGB(*LINE)
    c.setLineWidth(lw)
    c.line(x, Y(t), x, Y(t) - h)


def text(c, s, x, t, font="Helvetica", size=8, align="l", max_w=None, rgb=INK):
    """Écrit un texte dont la ligne de base est à t points du haut ; réduit la police si besoin."""
    s = "" if s is None else str(s)
    if max_w:
        while size > 4.5 and stringWidth(s, font, size) > max_w:
            size -= 0.25
    c.setFont(font, size)
    ink(c, rgb)
    if align == "c":
        c.drawCentredString(x, Y(t), s)
    elif align == "r":
        c.drawRightString(x, Y(t), s)
    else:
        c.drawString(x, Y(t), s)


def n2(value):
    return "—" if value is None else f"{float(value):05.2f}"


def coef_s(value):
    return f"{float(value):.1f}"


def dots(c, x1, x2, t):
    c.setStrokeColorRGB(*GREY)
    c.setLineWidth(0.5)
    c.setDash(1, 2)
    c.line(x1, Y(t), x2, Y(t))
    c.setDash()


# ---------------------------------------------------------------- en-tête
def draw_header(c, d):
    school = d["school"]
    if d.get("stale"):
        text(c, "Moyennes à actualiser : relancez « Calculer les bulletins » pour cette classe.",
             W / 2, 16, "Helvetica-Bold", 7.5, "c", rgb=(0.75, 0.15, 0.1))
    box(c, LM, 24, CW, 140, r=8)

    text(c, d["ministry"], LM + 14, 40, "Helvetica-Bold", 5.2, max_w=190)
    text(c, d["republic"], RM - 14, 40, "Helvetica-Bold", 6.4, "r")
    text(c, d["motto"], RM - 14, 48, "Helvetica-Oblique", 5.6, "r", rgb=GREY)

    text(c, school.name.upper(), LM + 22, 66, "Helvetica-Bold", 10.5, max_w=200)
    if school.phone:
        text(c, f"Tél : {school.phone}", LM + 22, 79, "Helvetica", 5.8, rgb=GREY)

    logo = getattr(school, "logo", None)
    if logo:
        try:
            cx, cy, r = LM + 58, Y(114), 28
            c.saveState()
            path = c.beginPath()
            path.circle(cx, cy, r)
            c.clipPath(path, stroke=0, fill=0)
            c.drawImage(logo.path, cx - r, cy - r, width=2 * r, height=2 * r,
                        preserveAspectRatio=True, anchor="c", mask="auto")
            c.restoreState()
            c.setStrokeColorRGB(*LINE)
            c.setLineWidth(0.6)
            c.circle(cx, cy, r, stroke=1, fill=0)
        except Exception:
            pass

    text(c, d["title"], W / 2, 82, "Helvetica-Bold", 12.5, "c", max_w=270)
    text(c, d["year"], W / 2, 105, "Helvetica", 11.5, "c")
    text(c, d["student_name"], W / 2, 134, "Helvetica-Bold", 10.5, "c", max_w=330)

    parts = [f"Sexe : {d['gender']}"]
    if d["admission_code"]:
        parts.append(f"Statut : {d['admission_code']}")
    parts += [f"Classe : {d['class_name']}", f"Effectif : {d['effectif']}",
              f"Matricule : {d['matricule']}"]
    text(c, "      ".join(parts), W / 2, 155, "Helvetica-Bold", 8.4, "c", max_w=CW - 30)


# ---------------------------------------------------------------- tableau
def draw_table_header(c, t, h=29):
    box(c, LM, t, CW, h, r=5)
    for x in XS[1:-1]:
        vline(c, x, t, h)
    text(c, "Matières", LM + 8, t + 18, "Helvetica-Bold", 9)
    titles = {
        1: ["Moy.", "classe", "(1)"], 2: ["Note", "Compo", "(2)"], 3: ["Moy.sem", "(3)"],
        4: ["Coef", "(4)"], 5: ["Moy.Coef", "(3) x (4)"],
    }
    for i, lines in titles.items():
        cx = (XS[i] + XS[i + 1]) / 2
        top = t + (h - 6.4 * len(lines)) / 2 + 5.2
        for k, line in enumerate(lines):
            text(c, line, cx, top + k * 6.4, "Helvetica-Bold", 5, "c")
    for i, label in ((6, "Rang"), (7, "Appréciation"), (8, "Professeurs")):
        text(c, label, (XS[i] + XS[i + 1]) / 2, t + 18, "Helvetica-Bold", 8, "c", max_w=COLS[i] - 6)


def build_items(d):
    items = []
    for group in d["groups"]:
        if group["title"]:
            items.append(("title", group["title"]))
        items += [("row", r) for r in group["rows"]]
        if group["totals"]:
            items.append(("subtotal", group["totals"]))
    items.append(("total_a", d["total_a"]))
    return items


def draw_table(c, d, t0, t_limit):
    items = build_items(d)
    pitch = max(11.0, min(18.6, (t_limit - t0) / max(len(items), 1)))
    scale = min(1.0, pitch / 18.6)
    fs = max(6.0, 8.0 * scale + 0.4)
    h = pitch - 2.0
    t = t0
    for kind, data in items:
        mid = t + h / 2 + fs * 0.34
        if kind == "title":
            text(c, data, LM + 4, t + h * 0.75, "Helvetica-Oblique", fs, rgb=GREY)
        elif kind == "row":
            box(c, LM, t, CW, h, r=4, lw=0.6)
            for x in XS[1:-1]:
                vline(c, x, t, h, lw=0.35)
            text(c, data["name"], LM + 6, mid, "Helvetica", fs, max_w=COLS[0] - 10)
            text(c, n2(data["continuous"]), (XS[1] + XS[2]) / 2, mid, "Helvetica", fs, "c")
            text(c, n2(data["composition"]), (XS[2] + XS[3]) / 2, mid, "Helvetica", fs, "c")
            text(c, n2(data["average"]), (XS[3] + XS[4]) / 2, mid, "Helvetica", fs, "c")
            text(c, coef_s(data["coef"]), (XS[4] + XS[5]) / 2, mid, "Helvetica", fs, "c")
            text(c, n2(data["points"]), (XS[5] + XS[6]) / 2, mid, "Helvetica-Bold", fs, "c")
            text(c, ordinal(data["rank"]), (XS[6] + XS[7]) / 2, mid, "Helvetica", fs - 1, "c")
            text(c, data["appreciation"], XS[7] + 4, mid, "Helvetica", fs - 0.6, max_w=COLS[7] - 6)
            text(c, data["teacher"], XS[8] + 4, mid, "Helvetica", fs - 1.4, max_w=COLS[8] - 6, rgb=GREY)
        elif kind == "subtotal":
            box(c, XS[4], t, XS[7] - XS[4], h, r=4, lw=0.6)
            vline(c, XS[5], t, h, 0.35)
            vline(c, XS[6], t, h, 0.35)
            text(c, coef_s(data["coef"]), (XS[4] + XS[5]) / 2, mid, "Helvetica-Bold", fs, "c")
            text(c, n2(data["points"]), (XS[5] + XS[6]) / 2, mid, "Helvetica-Bold", fs, "c")
            text(c, n2(data["average"]), (XS[6] + XS[7]) / 2, mid, "Helvetica-Bold", fs + 0.8, "c")
        elif kind == "total_a":
            box(c, LM, t, CW, h, r=4, lw=0.6)
            vline(c, XS[4], t, h, 0.35)
            vline(c, XS[5], t, h, 0.35)
            vline(c, XS[6], t, h, 0.35)
            text(c, "Matières Obligatoires (A)", LM + 6, mid, "Helvetica-Bold", fs)
            text(c, coef_s(data["coef"]), (XS[4] + XS[5]) / 2, mid, "Helvetica-Bold", fs, "c")
            text(c, n2(data["points"]), (XS[5] + XS[6]) / 2, mid, "Helvetica-Bold", fs, "c")
        t += pitch if kind != "title" else pitch * 0.85


# ---------------------------------------------------------------- bas de page
def draw_summary(c, d):
    left_w = 416
    # (B) matières optionnelles
    box(c, LM, 537, left_w, 19, r=4)
    for x in (XS[4], XS[5], XS[6]):
        vline(c, x, 537, 19, 0.35)
    text(c, "Moyenne mat. optionnelles (B)", LM + 6, 549.5, "Helvetica", 8)
    text(c, "00.00", (XS[5] + XS[6]) / 2, 549.5, "Helvetica-Bold", 8, "c")
    # total définitif
    box(c, LM, 558, left_w, 19, r=4)
    for x in (XS[4], XS[5], XS[6]):
        vline(c, x, 558, 19, 0.35)
    text(c, "Total définitif (A + B)", LM + 6, 570.5, "Helvetica", 8)
    text(c, coef_s(d["total_a"]["coef"]), (XS[4] + XS[5]) / 2, 570.5, "Helvetica-Bold", 8, "c")
    text(c, n2(d["total_a"]["points"]), (XS[5] + XS[6]) / 2, 570.5, "Helvetica-Bold", 8, "c")
    # moyenne, rang, appréciation
    box(c, LM, 579, left_w, 27, r=4)
    text(c, "Moyenne :", LM + 8, 596, "Helvetica-Oblique", 8.5)
    text(c, n2(d["average"]), LM + 60, 596, "Helvetica-Bold", 10)
    text(c, "Rang :", LM + 128, 596, "Helvetica-Oblique", 8.5)
    text(c, ordinal(d["rank"]) if d["rank"] else "—", LM + 160, 596, "Helvetica-Bold", 10)
    text(c, d["general_label"], LM + 218, 596, "Helvetica-Bold", 9, max_w=left_w - 226)
    # moyenne en lettres
    box(c, LM, 608, left_w, 18, r=4)
    text(c, d["average_words"], LM + left_w / 2, 620, "Helvetica-Oblique", 9, "c", max_w=left_w - 16)

    # statistiques de la classe
    sx = LM + left_w + 6
    sw = RM - sx
    box(c, sx, 537, sw, 89, r=4)
    stats = [("Plus faible moyenne", d["low"]), ("Moyenne de la classe", d["class_average"]),
             ("Plus forte moyenne", d["high"])]
    for i, (label, value) in enumerate(stats):
        base = 562 + i * 25
        text(c, label, sx + 7, base, "Helvetica", 6.2, rgb=GREY, max_w=sw - 44)
        text(c, n2(value), RM - 8, base, "Helvetica-Bold", 8.5, "r")


def draw_footer(c, d):
    box(c, LM, 632, CW, 158, r=6)
    absences = d["absences"]
    text(c, f"Absences : {absences}", LM + 12, 650, "Helvetica-Oblique", 7.5)
    if d["lates"]:
        text(c, f"Retards : {d['lates']}", LM + 90, 650, "Helvetica-Oblique", 7.5)
    text(c, "Conduite :", LM + 12, 676, "Helvetica", 8.5)
    dots(c, LM + 62, LM + 215, 677)
    text(c, "Conseil des professeurs :", 290, 650, "Helvetica-Oblique", 7.5)
    dots(c, 290, RM - 14, 676)
    dots(c, 290, RM - 14, 696)

    c.setStrokeColorRGB(*LINE)
    c.setLineWidth(0.5)
    c.line(LM, Y(712), RM, Y(712))

    place = f"{d['city']} " if d["city"] else ""
    text(c, "Titulaire", LM + 12, 728, "Helvetica", 8)
    text(c, f"{place}{date.today():%d/%m/%Y}", W / 2, 724, "Helvetica", 8, "c")
    text(c, d["principal_title"], RM - 120, 728, "Helvetica", 8)
    text(c, d["head_teacher"], LM + 12, 782, "Helvetica-Bold", 7.2, max_w=190)
    text(c, d["principal"], RM - 120, 782, "Helvetica-Bold", 7.2, max_w=108)


# ---------------------------------------------------------------- point d'entrée
def build_report_card_pdf(report_card: ReportCard) -> bytes:
    d = build_bulletin_context(report_card)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"Bulletin {d['student_name']} - {d['title']}")
    c.setAuthor(d["school"].name)

    _draw_watermark(c)
    draw_header(c, d)
    draw_table_header(c, 166)
    draw_table(c, d, t0=199, t_limit=530)
    draw_summary(c, d)
    draw_footer(c, d)

    c.showPage()
    c.save()
    return buffer.getvalue()
