import re
import secrets
import unicodedata

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import ActivityLog, User

# Sans caractères ambigus (0/O, 1/l/I) pour éviter les erreurs de saisie
PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def log_activity(user, action, instance=None, description=""):
    ActivityLog.objects.create(
        school=getattr(user, "school", None), user=user, action=action,
        model=instance.__class__.__name__ if instance is not None else "",
        object_id=str(instance.pk) if instance is not None else "",
        description=description,
    )


def generate_password(length=10):
    return "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))


def clean_password(password):
    """Mot de passe fourni (8 caractères min.) ou généré automatiquement."""
    if password is None or password == "":
        return generate_password()
    password = str(password)
    if len(password) < 8:
        raise ValidationError({"password": "8 caractères minimum."})
    return password


def _slug(text):
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", text.lower())


def generate_username(first_name, last_name):
    base = f"{_slug(first_name)}.{_slug(last_name)}".strip(".")[:40] or "utilisateur"
    candidate, n = base, 1
    while User.objects.filter(username__iexact=candidate).exists():
        n += 1
        candidate = f"{base}{n}"
    return candidate


@transaction.atomic
def create_access_for(profile, role, acting_user, username=None, password=None):
    """Crée le compte de connexion d'un enseignant, parent ou élève et le relie à sa fiche."""
    if profile.user_id:
        raise ValidationError({"detail": "Cette fiche a déjà un compte de connexion."})

    if username:
        username = str(username).strip()
        try:
            User._meta.get_field("username").run_validators(username)
        except DjangoValidationError as exc:
            raise ValidationError({"username": exc.messages})
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError({"username": "Cet identifiant est déjà utilisé."})
    else:
        username = generate_username(profile.first_name, profile.last_name)

    password = clean_password(password)

    user = User(
        username=username,
        first_name=(profile.first_name or "")[:150],
        last_name=(profile.last_name or "")[:150],
        email=getattr(profile, "email", "") or "",
        phone=getattr(profile, "phone", "") or "",
        role=role,
        school=profile.school,
    )
    user.set_password(password)
    user.save()

    profile.user = user
    profile.save(update_fields=["user"])

    log_activity(acting_user, "CREATE", user,
                 f"Création du compte « {username} » ({role}) pour {profile}")
    return {"user_id": user.id, "username": user.username, "password": password,
            "role": role, "name": str(profile)}