"""Permissions DRF basées sur les groupes/rôles Django.

Le modèle d'accès reproduit celui de l'app Django (middleware + accueils) :
- ResProd : écrit la production ; ne voit jamais le commercial.
- Commercial : écrit le commercial ; ne voit jamais la production.
- Finance : gère la trésorerie ; lecture des rapports (production + distribution).
- Direction : supervision — lecture de tout, gère les utilisateurs.
Les superusers/staff ont accès à tout.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


def _user_groups(user):
    return set(user.groups.values_list('name', flat=True))


class HasAnyRole(BasePermission):
    """Autorise si l'utilisateur appartient à l'un des rôles requis (ou Direction)."""

    required_roles: list[str] = []

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True
        allowed = set(self.required_roles) | {'Direction'}
        return bool(_user_groups(user) & allowed)


class RoleReadWrite(BasePermission):
    """Rôles distincts pour la lecture (GET) et l'écriture (POST/PUT/PATCH/DELETE)."""

    read_roles: list[str] = []
    write_roles: list[str] = []

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True
        groups = _user_groups(user)
        allowed = self.read_roles if request.method in SAFE_METHODS else self.write_roles
        return bool(groups & set(allowed))


def role_permission(*roles):
    """Fabrique une classe de permission pour les rôles donnés (lecture + écriture)."""
    return type('RolePermission', (HasAnyRole,), {'required_roles': list(roles)})


def rw(read, write):
    """Fabrique une permission lecture/écriture différenciée."""
    return type('RW', (RoleReadWrite,), {'read_roles': list(read), 'write_roles': list(write)})


# --- Domaines opérationnels (écriture réservée au rôle propriétaire) ---
# Production : écrite par ResProd, lue aussi par Finance/Direction (rapports).
CanProduction = rw(read=['ResProd', 'Finance', 'Direction'], write=['ResProd'])
# Commercial : écrit par Commercial, lu aussi par Finance/Direction (rapports).
CanCommercial = rw(read=['Commercial', 'Finance', 'Direction'], write=['Commercial'])
# Trésorerie : gérée par Finance, lue par Direction.
CanFinance = rw(read=['Finance', 'Direction'], write=['Finance'])
# Utilisateurs : Direction uniquement.
IsDirection = role_permission('Direction')
# Reporting agrégé : tous les rôles authentifiés (chaque rapport filtré côté front).
IsReportingViewer = role_permission('ResProd', 'Commercial', 'Finance')
