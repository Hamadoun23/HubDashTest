"""Permissions communes.

Le decoupage est volontairement pauvre : l'appartenance a l'application se
verifie ici, une fois pour toutes ; les regles metier fines restent dans le
service concerne, ou elles peuvent etre lues avec le reste du domaine.
"""

from django.conf import settings
from rest_framework import permissions


class EstHabilite(permissions.BasePermission):
    """Refuse quiconque n'a aucun role sur l'application de ce service.

    C'est la permission par defaut de tous les services : un compte GDA Hub
    valide n'ouvre pas toutes les applications, seulement celles ou une
    habilitation existe.
    """

    message = "Vous n'etes pas habilite sur cette application."

    def has_permission(self, request, view):
        utilisateur = getattr(request, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_acces(settings.GDAHUB_APPLICATION)


class ARole(permissions.BasePermission):
    """Exige l'un des roles listes par la vue dans `roles_requis`.

    Exemple :

        class VueValidation(APIView):
            permission_classes = [EstHabilite, ARole]
            roles_requis = ["admin", "direction"]
    """

    message = "Votre role ne permet pas cette action."

    def has_permission(self, request, view):
        roles = getattr(view, "roles_requis", None)
        if not roles:
            return True
        utilisateur = getattr(request, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*roles)


class LectureSeulePour(permissions.BasePermission):
    """Laisse lire tout le monde, n'autorise l'ecriture qu'a certains roles.

    La vue declare `roles_ecriture`.
    """

    message = "Votre role ne permet que la consultation."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        roles = getattr(view, "roles_ecriture", None)
        if not roles:
            return True
        utilisateur = getattr(request, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*roles)
