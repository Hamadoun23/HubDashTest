"""Qui a le droit d'administrer les comptes.

Identity se protege avec ses propres jetons, comme n'importe quel autre
service : l'administration du hub est une habilitation sur l'application
« hub » avec le role « admin ».
"""

from rest_framework import permissions


class EstAdminHub(permissions.BasePermission):
    message = "Reserve aux administrateurs de GDA Hub."

    def has_permission(self, request, view):
        utilisateur = getattr(request, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.est_superadmin or "admin" in utilisateur.roles


class EstConnecte(permissions.BasePermission):
    """Un jeton valide suffit : sert aux routes « mon compte »."""

    message = "Authentification requise."

    def has_permission(self, request, view):
        utilisateur = getattr(request, "user", None)
        return utilisateur is not None and utilisateur.is_authenticated
