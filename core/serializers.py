from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from schools.models import School

from .models import ActivityLog, User
from .services import log_activity


class LoginSerializer(TokenObtainPairSerializer):
    """Connexion : ajoute rôle et établissement au token JWT (§7.1)."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["school"] = user.school_id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.school_id and not self.user.school.is_active:
            raise AuthenticationFailed(
                "Cet établissement est désactivé. Contactez l'administrateur de la plateforme.")
        log_activity(self.user, "LOGIN", None, "Connexion réussie.")
        return data


class UserSerializer(serializers.ModelSerializer):
    school_name = serializers.SerializerMethodField()
    linked_to = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "phone",
                  "role", "school", "school_name", "is_active", "last_login", "linked_to"]
        read_only_fields = ["role", "school", "last_login"]

    def get_school_name(self, obj):
        return obj.school.name if obj.school else None

    def get_linked_to(self, obj):
        """Nom de la fiche (enseignant, parent ou élève) reliée à ce compte."""
        for attr in ("teacher_profile", "parent_profile", "student_profile"):
            profile = getattr(obj, attr, None)
            if profile is not None:
                return f"{profile.last_name} {profile.first_name}"
        return None


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Ce qu'un utilisateur peut modifier lui-même (jamais son rôle ni son établissement)."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False,
                                     style={"input_type": "password"})
    school = serializers.PrimaryKeyRelatedField(queryset=School.objects.all(),
                                                required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "phone",
                  "role", "school", "is_active", "password"]

    def validate_role(self, value):
        user = getattr(self.context.get("request"), "user", None)
        if value == "SUPER_ADMIN" and not (user and user.is_super_admin):
            raise serializers.ValidationError("Rôle non autorisé.")
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Mot de passe requis."})
        acting = getattr(self.context.get("request"), "user", None)
        role = attrs.get("role", getattr(self.instance, "role", None))
        if acting and acting.is_super_admin and role != "SUPER_ADMIN":
            school = attrs.get("school", getattr(self.instance, "school", None))
            if school is None:
                raise serializers.ValidationError(
                    {"school": "Établissement requis pour ce rôle."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)  # mots de passe hashés
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)  # jamais de mot de passe en clair
            user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Ancien mot de passe incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user


class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "user", "username", "action", "model", "object_id",
                  "description", "created_at"]