from decimal import Decimal

from rest_framework import serializers

from academics.models import ClassRoom, Enrollment, Subject, TeachingAssignment

from .models import Grade, Period, ReportCard, ReportCardLine


class PeriodSerializer(serializers.ModelSerializer):
    school_year_label = serializers.CharField(source="school_year.label", read_only=True)

    class Meta:
        model = Period
        fields = ["id", "school", "school_year", "school_year_label", "name", "order",
                  "start_date", "end_date", "is_locked"]
        extra_kwargs = {"school": {"required": False}}

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and start >= end:
            raise serializers.ValidationError("La date de fin doit suivre la date de début.")
        return attrs


class GradeSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    matricule = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    period_name = serializers.CharField(source="period.name", read_only=True)
    enrollment_id = serializers.PrimaryKeyRelatedField(queryset=Enrollment.objects.all(),
                                                       source="enrollment")

    class Meta:
        model = Grade
        fields = ["id", "enrollment_id", "student", "matricule", "class_name",
                  "subject", "subject_name", "period", "period_name",
                  "assessment_type", "sequence", "value", "coefficient", "created_at"]

    def get_student(self, obj):
        return str(obj.enrollment.student)

    def get_matricule(self, obj):
        return obj.enrollment.student.matricule

    def get_class_name(self, obj):
        return obj.enrollment.class_room.name

    def validate(self, attrs):
        enrollment = attrs.get("enrollment", getattr(self.instance, "enrollment", None))
        subject = attrs.get("subject", getattr(self.instance, "subject", None))
        period = attrs.get("period", getattr(self.instance, "period", None))
        if period and period.is_locked:
            raise serializers.ValidationError({"period": "Période verrouillée : saisie interdite."})
        if enrollment and period and enrollment.school_year_id != period.school_year_id:
            raise serializers.ValidationError("Inscription et période d'années différentes.")
        if enrollment and subject and not TeachingAssignment.objects.filter(
                subject=subject, class_room=enrollment.class_room,
                school_year=enrollment.school_year).exists():
            raise serializers.ValidationError("Matière non enseignée dans cette classe.")
        return attrs


class GradeNoteSerializer(serializers.Serializer):
    enrollment_id = serializers.PrimaryKeyRelatedField(queryset=Enrollment.objects.all(),
                                                       source="enrollment")
    value = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=20)
    coefficient = serializers.DecimalField(max_digits=3, decimal_places=1,
                                           min_value=Decimal("0.5"), default=Decimal("1"))


class BulkGradeSerializer(serializers.Serializer):
    """Saisie groupée : classe + matière + période + notes (§4.9)."""
    class_room_id = serializers.PrimaryKeyRelatedField(queryset=ClassRoom.objects.all(),
                                                       source="class_room")
    subject_id = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(),
                                                    source="subject")
    period_id = serializers.PrimaryKeyRelatedField(queryset=Period.objects.all(),
                                                   source="period")
    assessment_type = serializers.ChoiceField(choices=Grade.AssessmentType.choices,
                                              default=Grade.AssessmentType.DEVOIR)
    sequence = serializers.IntegerField(min_value=1, default=1)
    notes = GradeNoteSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        period, class_room, subject = attrs["period"], attrs["class_room"], attrs["subject"]
        if period.is_locked:
            raise serializers.ValidationError({"period_id": "Période verrouillée."})
        if {class_room.school_id, period.school_id, subject.school_id} != {class_room.school_id}:
            raise serializers.ValidationError("Classe, période et matière d'établissements différents.")
        for note in attrs["notes"]:
            enrollment = note["enrollment"]
            if (enrollment.class_room_id != class_room.id
                    or enrollment.school_year_id != period.school_year_id):
                raise serializers.ValidationError(
                    {"notes": f"{enrollment} n'est pas dans cette classe pour cette année."})
        return attrs


class ComputeReportSerializer(serializers.Serializer):
    class_room_id = serializers.PrimaryKeyRelatedField(queryset=ClassRoom.objects.all(),
                                                       source="class_room")
    period_id = serializers.PrimaryKeyRelatedField(queryset=Period.objects.all(),
                                                   source="period")


class ReportCardLineSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = ReportCardLine
        fields = ["subject", "subject_name", "coefficient", "average", "appreciation"]


class ReportCardSerializer(serializers.ModelSerializer):
    lines = ReportCardLineSerializer(many=True, read_only=True)
    student = serializers.SerializerMethodField()
    matricule = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    school_year = serializers.SerializerMethodField()
    period_name = serializers.CharField(source="period.name", read_only=True)

    class Meta:
        model = ReportCard
        fields = ["id", "student", "matricule", "class_name", "school_year", "period",
                  "period_name", "total_points", "total_coefficients", "average",
                  "class_average", "rank", "mention", "absences_count", "lates_count",
                  "is_validated", "generated_at", "lines"]

    def get_student(self, obj):
        return str(obj.enrollment.student)

    def get_matricule(self, obj):
        return obj.enrollment.student.matricule

    def get_class_name(self, obj):
        return obj.enrollment.class_room.name

    def get_school_year(self, obj):
        return obj.enrollment.school_year.label