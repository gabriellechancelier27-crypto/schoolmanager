from rest_framework import serializers

from .models import School, SchoolYear


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ["id", "name", "code", "address", "city", "phone", "email", "logo",
                  "currency", "grade_scale", "pass_mark", "is_active", "created_at"]


class SchoolYearSerializer(serializers.ModelSerializer):
    school_name = serializers.SerializerMethodField()

    class Meta:
        model = SchoolYear
        fields = ["id", "school", "school_name", "label", "start_date", "end_date",
                  "is_current", "is_archived"]
        extra_kwargs = {"school": {"required": False}}
        validators = []  # unicité (école, libellé) vérifiée dans validate()

    def get_school_name(self, obj):
        return obj.school.name

    def validate(self, attrs):
        request = self.context.get("request")
        school = (attrs.get("school") or getattr(self.instance, "school", None)
                  or (request.user.school if request else None))
        label = attrs.get("label", getattr(self.instance, "label", None))
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and start >= end:
            raise serializers.ValidationError("La date de fin doit suivre la date de début.")
        if school and label:
            qs = SchoolYear.objects.filter(school=school, label=label)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"label": "Cette année scolaire existe déjà."})
        return attrs