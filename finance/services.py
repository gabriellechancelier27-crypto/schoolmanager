from decimal import Decimal

from django.db.models import Q, Sum

from academics.models import Enrollment

from .models import Fee, Payment


def applicable_fees(enrollment):
    """Frais généraux + frais spécifiques à la classe de l'élève (§6.1)."""
    return Fee.objects.filter(school_year=enrollment.school_year, is_active=True
                              ).filter(Q(class_room__isnull=True) | Q(class_room=enrollment.class_room))


def enrollment_balance(enrollment):
    """Montant dû / payé / restant (§6.2)."""
    due = applicable_fees(enrollment).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    paid = Payment.objects.filter(enrollment=enrollment
                                  ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    return {"du": due, "paye": paid, "reste": due - paid}


def school_financial_summary(school, school_year):
    """Synthèse : impayés et taux de recouvrement (§6.4, §4.16)."""
    total_due, total_paid = Decimal("0"), Decimal("0")
    enrollments = (Enrollment.objects.filter(school_year=school_year,
                    status=Enrollment.Status.ACTIVE).select_related("class_room"))
    for enrollment in enrollments:
        due = applicable_fees(enrollment).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        paid = Payment.objects.filter(enrollment=enrollment
                ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        total_due += due
        total_paid += paid
    return {"total_du": total_due, "total_paye": total_paid,
            "impayes": total_due - total_paid,
            "taux_recouvrement": round(float(total_paid / total_due * 100), 1) if total_due else 0}