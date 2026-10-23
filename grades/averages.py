"""Règle de calcul des moyennes : un seul endroit, utilisé par le calcul et par le bulletin.

Deux types d'évaluation :
  - Devoir       : sa moyenne est la « moyenne de classe » (colonne 1 du bulletin) ;
  - Composition  : sa moyenne est la « note de composition » (colonne 2).
Moyenne de la matière (colonne 3) = (colonne 1 + colonne 2) / 2.
Si l'une des deux manque, l'autre compte seule.
"""
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
DEVOIR = "DEVOIR"
COMPOSITION = "COMPOSITION"
ALLOWED_TYPES = [(DEVOIR, "Devoir"), (COMPOSITION, "Composition")]


def mean(values):
    values = list(values)
    if not values:
        return None
    return (sum(values, Decimal("0")) / len(values)).quantize(CENT, rounding=ROUND_HALF_UP)


def split_grades(grades):
    """(moyenne des devoirs, moyenne des compositions) ; None si aucune note de ce type.
    Tout ce qui n'est pas une composition est traité comme un devoir (anciennes données)."""
    devoirs = [g.value for g in grades if g.assessment_type != COMPOSITION]
    compositions = [g.value for g in grades if g.assessment_type == COMPOSITION]
    return mean(devoirs), mean(compositions)


def semester_average(devoir_avg, composition_avg):
    """(devoirs + composition) / 2, arrondi au centième."""
    parts = [v for v in (devoir_avg, composition_avg) if v is not None]
    if not parts:
        return None
    return (sum(parts, Decimal("0")) / len(parts)).quantize(CENT, rounding=ROUND_HALF_UP)
