from rest_framework import permissions

MANAGER_ROLES = ("SCHOOL_ADMIN", "DIRECTOR")
STAFF_ROLES = ("SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT")


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_super_admin)


class IsSchoolAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_super_admin or u.role == "SCHOOL_ADMIN"))


class IsManager(permissions.BasePermission):
    """Administrateur ou directeur : pilotage de l'établissement (§3.2/§3.3)."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_super_admin or u.role in MANAGER_ROLES))


class IsSchoolStaff(permissions.BasePermission):
    """Tout personnel : admin, directeur, enseignant, comptable."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_super_admin or u.role in STAFF_ROLES))


class ReadOnlyOrManager(permissions.BasePermission):
    """Lecture : tout utilisateur authentifié (données filtrées par rôle).
    Écriture : administrateur ou directeur."""
    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return u.is_super_admin or u.role in MANAGER_ROLES


class CanEnterGrades(permissions.BasePermission):
    """Saisie de notes : enseignant, admin, directeur (§3.4)."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated
                    and (u.is_super_admin or u.role in MANAGER_ROLES + ("TEACHER",)))


class CanRecordAttendance(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated
                    and (u.is_super_admin or u.role in MANAGER_ROLES + ("TEACHER",)))


class IsAccountantOrManager(permissions.BasePermission):
    """Paiements / dépenses / frais (§3.5)."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated
                    and (u.is_super_admin or u.role in MANAGER_ROLES + ("ACCOUNTANT",)))