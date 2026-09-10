"""Permissions — meme esprit que Chantiers (`chantiers/permissions.py`).

Trois profils, fideles aux middlewares Laravel d'origine :
- admin (ou superadmin du hub) : lecture et ecriture totales.
- team : lecture seule partout (`EnsureTeamReadOnly`).
- client : lecture seule, et seulement sur son propre `ClientPlanning`
  (`EnsureClientAccess` + les vues `client-space.*`).
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class EcritureReserveeAAdmin(BasePermission):
    """Team et client sont lecture seule ; seul admin (ou superadmin) ecrit."""

    def has_permission(self, requete, vue):
        if not requete.user or not requete.user.is_authenticated:
            return False
        if requete.method in SAFE_METHODS:
            return True
        return requete.user.peut_ecrire


class AccesClientRestreint(BasePermission):
    """Un compte client ne voit que les objets rattaches a son propre client."""

    def has_object_permission(self, requete, vue, obj):
        if not requete.user.est_client:
            return True
        client_id = getattr(obj, "client_id", None) or getattr(obj, "id", None)
        return client_id == requete.user.client_id


class ReserveEquipe(BasePermission):
    """Equivalent de `EnsureAdminOrTeam` : un compte client n'a rien a faire ici.

    Cote Laravel, les idees de contenu, les calendriers globaux de tournages/
    publications et le tableau de bord sont hors du perimetre client — seul
    son propre `ClientPlanning` (routes `clients.dashboard`/`clients.show*`)
    lui est ouvert.
    """

    def has_permission(self, requete, vue):
        return bool(requete.user and requete.user.is_authenticated and requete.user.est_equipe)
