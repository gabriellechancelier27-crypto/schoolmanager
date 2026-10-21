from rest_framework import serializers

from schools.models import SchoolYear

from .models import (ClassRoom, Enrollment, Parent, Student, StudentParent,
                     Subject, Teacher, TeachingAssignment)


def _request_school(serializer):
    request = serializer.context.get("request")
    return getattr(getattr(request, "user", None), "school", None)


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = ["id", "user", "matricule", "first_name", "last_name", "gender", "phone",
                  "email", "address", "status", "created_at"]
        read_only_fields = ["matricule"]


class ParentSerializer(serializers.ModelSerializer):
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Parent
        fields = ["id", "user", "first_name", "last_name", "phone", "email", "address",
                  "profession", "children_count", "created_at"]

    def get_children_count(self, obj):
        return obj.student_parents.count()


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "code", "default_coefficient", "category"]

    def validate_name(self, value):
        school = _request_school(self)
        if school:
            qs = Subject.objects.filter(school=school, name=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("Une matière de ce nom existe déjà.")
        return value


class ClassRoomSerializer(serializers.ModelSerializer):
    main_teacher_name = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = ClassRoom
        fields = ["id", "name", "level", "serie", "capacity", "main_teacher",
                  "main_teacher_name", "is_active", "student_count"]

    def get_main_teacher_name(self, obj):
        return str(obj.main_teacher) if obj.main_teacher else ""

    def get_student_count(self, obj):
        return obj.enrollments.filter(status=Enrollment.Status.ACTIVE,
                                      school_year__is_current=True).count()

    def validate_name(self, value):
        school = _request_school(self)
        if school:
            qs = ClassRoom.objects.filter(school=school, name=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("Une classe de ce nom existe déjà.")
        return value


class StudentParentSerializer(serializers.ModelSerializer):
    parent = ParentSerializer(read_only=True)

    class Meta:
        model = StudentParent
        fields = ["id", "parent", "relation"]


class StudentSerializer(serializers.ModelSerializer):
    parents = StudentParentSerializer(source="student_parents", many=True, read_only=True)
    current_class = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = ["id", "user", "matricule", "first_name", "last_name", "gender", "birth_date",
                  "birth_place", "address", "phone", "photo", "status", "admission_code",
                  "current_class", "parents", "created_at"]
        read_only_fields = ["matricule"]

    def get_current_class(self, obj):
        return obj.current_class_name


class StudentLinkSerializer(serializers.Serializer):
    """Association élève ↔ parent."""
    parent_id = serializers.PrimaryKeyRelatedField(queryset=Parent.objects.all(), source="parent")
    relation = serializers.ChoiceField(choices=StudentParent.Relation.choices,
                                       default=StudentParent.Relation.TUTEUR)


class StudentWriteSerializer(serializers.ModelSerializer):
    links = StudentLinkSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = Student
        fields = ["id", "user", "matricule", "first_name", "last_name", "gender", "birth_date",
                  "birth_place", "address", "phone", "photo", "status", "admission_code", "links"]
        read_only_fields = ["matricule"]

    def validate_links(self, links):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and not user.is_super_admin:
            for link in links:
                if link["parent"].school_id != user.school_id:
                    raise serializers.ValidationError("Parent d'un autre établissement.")
        return links

    def create(self, validated_data):
        links = validated_data.pop("links", [])
        student = super().create(validated_data)
        for link in links:
            StudentParent.objects.get_or_create(student=student, parent=link["parent"],
                                                defaults={"relation": link["relation"]})
        return student

    def update(self, instance, validated_data):
        links = validated_data.pop("links", None)
        student = super().update(instance, validated_data)
        if links is not None:
            keep = [link["parent"] for link in links]
            StudentParent.objects.filter(student=student).exclude(parent__in=keep).delete()
            for link in links:
                StudentParent.objects.update_or_create(student=student, parent=link["parent"],
                                                       defaults={"relation": link["relation"]})
        return student


class EnrollmentSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    class_room_name = serializers.CharField(source="class_room.name", read_only=True)
    school_year_label = serializers.CharField(source="school_year.label", read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all(),
                                                    source="student", write_only=True)
    class_room_id = serializers.PrimaryKeyRelatedField(queryset=ClassRoom.objects.all(),
                                                       source="class_room", write_only=True)
    school_year_id = serializers.PrimaryKeyRelatedField(queryset=SchoolYear.objects.all(),
                                                        source="school_year", write_only=True)

    class Meta:
        model = Enrollment
        fields = ["id", "student", "student_id", "class_room_id", "class_room_name",
                  "school_year_id", "school_year_label", "date", "status", "created_at"]

    def validate(self, attrs):
        student = attrs.get("student", self.instance and self.instance.student)
        class_room = attrs.get("class_room", self.instance and self.instance.class_room)
        school_year = attrs.get("school_year", self.instance and self.instance.school_year)
        if student and class_room and student.school_id != class_room.school_id:
            raise serializers.ValidationError("Élève et classe d'établissements différents.")
        if class_room and school_year and class_room.school_id != school_year.school_id:
            raise serializers.ValidationError("Classe et année d'établissements différents.")
        if student and school_year and self.instance is None:
            if Enrollment.objects.filter(student=student, school_year=school_year).exists():
                raise serializers.ValidationError("Élève déjà inscrit pour cette année scolaire.")
        return attrs


class TeachingAssignmentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_room_name = serializers.CharField(source="class_room.name", read_only=True)
    school_year_label = serializers.CharField(source="school_year.label", read_only=True)

    class Meta:
        model = TeachingAssignment
        fields = ["id", "teacher", "teacher_name", "subject", "subject_name", "class_room",
                  "class_room_name", "school_year", "school_year_label", "coefficient"]

    def get_teacher_name(self, obj):
        return str(obj.teacher)
