"""Authentification — le jeton du hub est l'unique porte d'entree.

Meme principe que Chantiers (`chantiers/hub.py`) : Planning n'a jamais existe
hors du hub, donc pas de compte local a faire coexister avec le jeton.

**Le cas propre a Planning** : un compte « client » ne represente pas
n'importe qui de l'exterieur — il represente UN client precis (ClientPlanning)
et ne doit voir que ses donnees. Plutot que d'inventer un champ, on reutilise
`identifiants_locaux` : le meme mecanisme qui dit a Chantiers ou BDM sous quel
nom une personne y est connue dit ici sous quel `ClientPlanning.id` un compte
client est designe. Un administrateur du hub le renseigne depuis
`/administration`, exactement comme il rattacherait un compte a BDM.
"""

from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import authentication, exceptions

journal = logging.getLogger("planning.hub")

_CLIENT_JWKS = None


def _client_jwks():
    global _CLIENT_JWKS
    if _CLIENT_JWKS is None:
        from jwt import PyJWKClient

        _CLIENT_JWKS = PyJWKClient(settings.GDAHUB_JWKS_URL, cache_keys=True)
    return _CLIENT_JWKS


class UtilisateurHub:
    """Le principal DRF pour une requete authentifiee par le hub."""

    is_authenticated = True
    is_anonymous = False

    def __init__(
        self,
        id: int,
        identifiant: str,
        nom_complet: str,
        roles: list[str],
        est_superadmin: bool,
        client_id: int | None,
    ):
        self.id = id
        self.pk = id
        self.identifiant = identifiant
        self.nom_complet = nom_complet or identifiant
        self.roles = roles
        self.est_superadmin = est_superadmin
        self.client_id = client_id

    def __str__(self):
        return self.nom_complet

    @property
    def est_client(self) -> bool:
        """Un compte client, jamais un membre de l'equipe.

        Fidele a l'original (`User::isClient()`, role unique et exclusif) :
        « team » ou « admin » l'emportent toujours sur « client » si les deux
        sont presents par erreur de saisie — mieux vaut trop d'acces interne
        par erreur qu'un client qui verrait les donnees des autres.
        """
        if self.est_superadmin:
            return False
        return "client" in self.roles and not ({"admin", "team"} & set(self.roles))

    @property
    def est_equipe(self) -> bool:
        """Admin ou team — l'equipe interne, au sens le plus large."""
        return not self.est_client

    @property
    def peut_ecrire(self) -> bool:
        """Team est en lecture seule (`EnsureTeamReadOnly` cote Laravel) ; seul admin ecrit."""
        return self.est_superadmin or "admin" in self.roles


class AuthentificationHub(authentication.BaseAuthentication):
    """Verifie le jeton RS256 signe par `identity` et construit le principal."""

    mot_cle = "Bearer"

    def authenticate(self, requete):
        entete = authentication.get_authorization_header(requete).split()
        if len(entete) != 2 or entete[0].lower() != self.mot_cle.lower().encode():
            return None

        jeton = entete[1].decode()

        import jwt

        try:
            entetes = jwt.get_unverified_header(jeton)
        except jwt.PyJWTError:
            return None
        if entetes.get("alg") != "RS256":
            return None

        if not settings.GDAHUB_JWKS_URL:
            raise exceptions.AuthenticationFailed(
                "Le service n'est pas rattache a GDA Hub (GDAHUB_JWKS_URL absent)."
            )

        try:
            cle = _client_jwks().get_signing_key_from_jwt(jeton)
            charge = jwt.decode(
                jeton,
                cle.key,
                algorithms=["RS256"],
                issuer=settings.GDAHUB_JETON_EMETTEUR,
                audience=settings.GDAHUB_JETON_AUDIENCE,
            )
        except jwt.PyJWTError as erreur:
            raise exceptions.AuthenticationFailed(
                "Le jeton de GDA Hub n'a pas pu etre verifie."
            ) from erreur

        habilitations = charge.get("habilitations") or {}
        roles = habilitations.get(settings.CODE_APPLICATION) or []
        est_superadmin = bool(charge.get("est_superadmin"))

        if not roles and not est_superadmin:
            journal.warning(
                "Jeton valide pour « %s », mais sans habilitation « %s ».",
                charge.get("identifiant"),
                settings.CODE_APPLICATION,
            )
            raise exceptions.AuthenticationFailed(
                "Votre compte n'a pas acces au module Planning. "
                "Un administrateur de GDA Hub doit vous l'ouvrir."
            )

        try:
            identifiant_utilisateur = int(charge["sub"])
        except (KeyError, TypeError, ValueError) as erreur:
            raise exceptions.AuthenticationFailed("Jeton sans identifiant exploitable.") from erreur

        client_id = None
        if "client" in roles and not ({"admin", "team"} & set(roles)) and not est_superadmin:
            locaux = charge.get("identifiants_locaux") or {}
            brut = locaux.get(settings.CODE_APPLICATION)
            if brut and str(brut).isdigit():
                client_id = int(brut)
            else:
                journal.warning(
                    "Compte client « %s » sans identifiant_local exploitable — "
                    "aucun ClientPlanning ne peut lui etre associe.",
                    charge.get("identifiant"),
                )
                raise exceptions.AuthenticationFailed(
                    "Votre compte n'est rattache a aucun client. Contactez un administrateur."
                )

        utilisateur = UtilisateurHub(
            id=identifiant_utilisateur,
            identifiant=charge.get("identifiant", ""),
            nom_complet=charge.get("nom_complet", ""),
            roles=roles,
            est_superadmin=est_superadmin,
            client_id=client_id,
        )
        return (utilisateur, jeton)

    def authenticate_header(self, requete):
        return self.mot_cle
