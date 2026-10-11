from .models import ActivityLog


def log_activity(user, action, instance=None, description=""):
    ActivityLog.objects.create(
        school=getattr(user, "school", None), user=user, action=action,
        model=instance.__class__.__name__ if instance is not None else "",
        object_id=str(instance.pk) if instance is not None else "",
        description=description,
    )