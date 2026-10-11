from rest_framework import serializers

from academics.models import ClassRoom, Student, Subject
from schools.models import SchoolYear

from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    class_name = serializers.CharField(source="class_room.name", read_only=True)
    subject_name = serializers.SerializerMethodField()
    student_id = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all(),
                                                    source="student")
    class_room_id = serializers.PrimaryKeyRelatedField(queryset=ClassRoom.objects.all(),
                                                       source="class_room")
    subject_id = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(),
                                                    source="subject", required=False,
                                                    allow_null=True)
    school_year_id = serializers.PrimaryKeyRelatedField(queryset=SchoolYear.objects.all(),
                                                        source="school_year")

    class Meta:
        model = Attendance
        fields = ["id", "student_id", "student", "class_room_id", "class_name", "subject_id",
                  "subject_name", "school_year_id", "date", "start_time", "status",
                  "minutes_late", "reason", "created_at"]

    def get_student(self, obj):
        return str(obj.student)

    def get_subject_name(self, obj):
        return obj.subject.name if obj.subject else ""


class AttendanceCallEntrySerializer(serializers.Serializer):
    student_id = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all(), source="student")
    status = serializers.ChoiceField(choices=Attendance.Status.choices)
    minutes_late = serializers.IntegerField(min_value=0, required=False, default=0)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class AttendanceCallSerializer(serializers.Serializer):
    """Appel d'une classe (§4.12)."""
    class_room_id = serializers.PrimaryKeyRelatedField(queryset=ClassRoom.objects.all(),
                                                       source="class_room")
    school_year_id = serializers.PrimaryKeyRelatedField(queryset=SchoolYear.objects.all(),
                                                        source="school_year")
    subject_id = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(),
                                                    source="subject", required=False, allow_null=True)
    date = serializers.DateField()
    start_time = serializers.TimeField(required=False, allow_null=True)
    entries = AttendanceCallEntrySerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        class_room, school_year = attrs["class_room"], attrs["school_year"]
        if class_room.school_id != school_year.school_id:
            raise serializers.ValidationError("Classe et année scolaire incohérentes.")
        for entry in attrs["entries"]:
            if entry["student"].school_id != class_room.school_id:
                raise serializers.ValidationError({"entries": "Élève d'un autre établissement."})
        return attrs