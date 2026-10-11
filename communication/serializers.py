from rest_framework import serializers

from .models import Announcement, Notification


class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    class_room_name = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = ["id", "school", "title", "body", "author", "author_name", "target",
                  "class_room", "class_room_name", "role", "published_at"]
        read_only_fields = ["author"]
        extra_kwargs = {"school": {"required": False}}

    def get_author_name(self, obj):
        return obj.author.get_full_name() if obj.author else ""

    def get_class_room_name(self, obj):
        return obj.class_room.name if obj.class_room else ""

    def validate(self, attrs):
        target = attrs.get("target", getattr(self.instance, "target", "ALL"))
        if target == "CLASS" and not attrs.get("class_room",
                                               getattr(self.instance, "class_room", None)):
            raise serializers.ValidationError({"class_room": "Classe requise."})
        if target == "ROLE" and not attrs.get("role", getattr(self.instance, "role", "")):
            raise serializers.ValidationError({"role": "Rôle requis."})
        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "link", "is_read", "created_at"]