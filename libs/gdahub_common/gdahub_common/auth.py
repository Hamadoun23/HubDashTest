"""Authentification : le service verifie un jeton qu'il n'a pas emis.

Un seul service signe les jetons — identity. Tous les autres se contentent de
verifier la signature avec la cle publique publiee sur le JWKS d'identity, puis
lisent les habilitations qu'elle contient. Aucun service metier ne possede de
table d'utilisateurs : l'identite vit dans le jeton, et seul l'identifiant
numerique est stocke a cote des donnees metier.

Consequence a garder en tete : un droit retire dans identity ne prend effet
qu'a l'expiration du jeton d'acces (15 minutes par defaut). C'est le prix de
l'absence d'appel reseau a chaque requete ; pour une revocation immediate il
faudrait interroger identity, ce qui recreerait le couplage qu'on evite.
"""

from __future__ import annotations

import jwt
from django.conf import settings
from django.core.cache import cache
from rest_framework import authentication, exceptions

from gdahub_common.identite import UtilisateurJeton

__all__ = ["UtilisateurJeton", "AuthentificationJeton", "decoder", "vider_cache_cles"]


def _cles_publiques() -> jwt.PyJWKClient:
    """Client JWKS, mis en cache par processus.

    PyJWKClient garde son propre cache memoire des cles ; on ne recree pas le
    client a chaque requete pour ne pas le vider.
    """
    global _client
    try:
        return _client
    except NameError:
        pass
    _client = jwt.PyJWKClient(
        settings.GDAHUB_JWKS_URL,
        cache_keys=True,
        lifespan=settings.GDAHUB_JWKS_DUREE_CACHE,
    )
    return _client


def decoder(jeton: str) -> dict:
    """Verifie la signature et les claims, puis renvoie la charge utile."""
    try:
        cle = _cles_publiques().get_signing_key_from_jwt(jeton)
    except jwt.PyJWKClientError as erreur:  # identity injoignable ou cle inconnue
        raise exceptions.AuthenticationFailed(
            f"Impossible de verifier le jeton : {erreur}"
        ) from erreur
    try:
        return jwt.decode(
            jeton,
            cle.key,
            algorithms=["RS256"],
            audience=settings.GDAHUB_JETON_AUDIENCE,
            issuer=settings.GDAHUB_JETON_EMETTEUR,
        )
    except jwt.ExpiredSignatureError as erreur:
        raise exceptions.AuthenticationFailed("Jeton expire.") from erreur
    except jwt.InvalidTokenError as erreur:
        raise exceptions.AuthenticationFailed(f"Jeton invalide : {erreur}") from erreur


class AuthentificationJeton(authentication.BaseAuthentication):
    """Classe d'authentification DRF a declarer dans tous les services."""

    mot_cle = "Bearer"

    def authenticate(self, request):
        entete = authentication.get_authorization_header(request).split()
        if not entete or entete[0].decode().lower() != self.mot_cle.lower():
            return None
        if len(entete) != 2:
            raise exceptions.AuthenticationFailed(
                "En-tete Authorization mal forme : attendu « Bearer <jeton> »."
            )

        jeton = entete[1].decode()
        charge = decoder(jeton)

        if charge.get("token_type") != "access":
            raise exceptions.AuthenticationFailed(
                "Ce jeton n'est pas un jeton d'acces."
            )

        habilitations = charge.get("habilitations") or {}
        application = settings.GDAHUB_APPLICATION
        utilisateur = UtilisateurJeton(
            id=int(charge["sub"]),
            identifiant=charge.get("identifiant", ""),
            nom_complet=charge.get("nom_complet", ""),
            email=charge.get("email", ""),
            est_superadmin=bool(charge.get("est_superadmin")),
            roles=list(habilitations.get(application, [])),
            habilitations=habilitations,
            jeton=jeton,
        )
        return (utilisateur, jeton)

    def authenticate_header(self, request):
        return self.mot_cle


def vider_cache_cles() -> None:
    """A appeler apres une rotation de cle chez identity."""
    global _client
    try:
        del _client
    except NameError:
        pass
    cache.delete("gdahub:jwks")
