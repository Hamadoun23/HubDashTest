from rest_framework.permissions import SAFE_METHODS, BasePermission

from core.constants import ROLES_FINANCE, ROLES_RH, Role


class EstRH(BasePermission):
    message = "Reserve aux Ressources Humaines."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in ROLES_RH)


class EstFinance(BasePermission):
    message = "Reserve au departement Finance."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in ROLES_FINANCE)


class EstDirection(BasePermission):
    message = "Reserve a la Direction."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == Role.DIRECTION)


class LectureSeulePourEmploye(BasePermission):
    """Ecriture reservee au back-office, lecture ouverte aux authentifies."""

    roles_ecriture = ROLES_RH | ROLES_FINANCE

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role in self.roles_ecriture
