from rest_framework import serializers

from academics.models import Enrollment

from .models import Expense, Fee, Payment


class FeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fee
        fields = ["id", "school", "school_year", "category", "label", "amount",
                  "class_room", "due_date", "is_active", "created_at"]
        extra_kwargs = {"school": {"required": False}}


class PaymentSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    matricule = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    fee_label = serializers.SerializerMethodField()
    enrollment_id = serializers.PrimaryKeyRelatedField(queryset=Enrollment.objects.all(),
                                                       source="enrollment")
    fee_id = serializers.PrimaryKeyRelatedField(queryset=Fee.objects.all(), source="fee",
                                                required=False, allow_null=True)

    class Meta:
        model = Payment
        fields = ["id", "receipt_number", "enrollment_id", "student", "matricule",
                  "class_name", "fee_id", "fee_label", "amount", "method", "reference",
                  "paid_at", "recorded_by", "created_at"]
        read_only_fields = ["receipt_number", "recorded_by"]

    def get_student(self, obj):
        return str(obj.enrollment.student)

    def get_matricule(self, obj):
        return obj.enrollment.student.matricule

    def get_class_name(self, obj):
        return obj.enrollment.class_room.name

    def get_fee_label(self, obj):
        return str(obj.fee) if obj.fee else ""

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value

    def validate(self, attrs):
        enrollment = attrs.get("enrollment", getattr(self.instance, "enrollment", None))
        fee = attrs.get("fee", getattr(self.instance, "fee", None))
        if fee and enrollment and fee.school_year_id != enrollment.school_year_id:
            raise serializers.ValidationError(
                "Le frais concerné ne correspond pas à l'année de l'inscription.")
        return attrs


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = ["id", "school", "school_year", "category", "label", "description",
                  "amount", "date", "created_at"]
        extra_kwargs = {"school": {"required": False}}