"""Permissions du service Chantiers.

Deux niveaux, fideles a l'original Laravel (`User::ROLE_ADMIN` /
`ROLE_PARTNER`) : l'equipe interne, et le partenaire externe en lecture
seule, filtree et redigee (cf. `hub.UtilisateurHub.est_partenaire`).
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class LectureSeulePourPartenaire(BasePermission):
    """Un partenaire ne peut jamais ecrire, quel que soit l'ecran.

    Verifie `is_authenticated` avant tout : sans jeton, `request.user` est un
    `AnonymousUser` de Django, qui ne porte pas `est_partenaire` (cet attribut
    n'existe que sur `hub.UtilisateurHub`). Y acceder directement levait une
    `AttributeError` — un 500 la ou un refus propre (401) etait attendu.
    """

    message = "Acces en lecture seule pour un compte partenaire."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.est_partenaire:
            return request.method in SAFE_METHODS
        return True


class EstEquipeInterne(BasePermission):
    """Reserve au personnel interne — jamais a un partenaire, ni a personne."""

    message = "Reserve a l'equipe interne."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.est_interne)
