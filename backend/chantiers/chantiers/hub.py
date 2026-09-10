"""Authentification — le jeton du hub est l'unique porte d'entree.

Chantiers n'a jamais existe hors du hub (cf. PLAN.md : « non deployee »).
Contrairement a FinanceRH, Jus d'orange ou BDM, il n'y a donc pas de compte
local historique a faire coexister avec le compte unique — pas de mot de
passe maison, pas de table `users` a soi. La personne qui appelle cette API
est exactement celle que le jeton RS256 signe par `identity` decrit, ni plus
ni moins.

**Ce que ça change par rapport aux autres services du hub.** Ailleurs,
`hub.py` cherche un compte local existant et refuse le jeton s'il n'en trouve
pas — parce que l'application a sa propre notion de qui a le droit d'entrer,
independante du hub. Ici, il n'y a pas de second registre : les habilitations
portees par le jeton (`habilitations.daily`, cf. `identity/comptes/jetons.py`)
*sont* l'autorisation, dans son integralite. Un jeton valide sans habilitation
« daily » est donc rejete — pas parce qu'un compte local manque, mais parce
qu'aucun administrateur du hub n'a ouvert cette application a cette personne.
"""

from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import authentication, exceptions

journal = logging.getLogger("chantiers.hub")

_CLIENT_JWKS = None


def _client_jwks():
    global _CLIENT_JWKS
    if _CLIENT_JWKS is None:
        from jwt import PyJWKClient

        _CLIENT_JWKS = PyJWKClient(settings.GDAHUB_JWKS_URL, cache_keys=True)
    return _CLIENT_JWKS


class UtilisateurHub:
    """Le principal DRF pour une requete authentifiee par le hub.

    N'est adosse a aucune ligne de base : reconstruit a chaque requete a
    partir du jeton, il porte tout ce dont l'API a besoin pour decider qui
    peut voir ou modifier quoi.
    """

    is_authenticated = True
    is_anonymous = False

    def __init__(self, id: int, identifiant: str, nom_complet: str, roles: list[str], est_superadmin: bool):
        self.id = id
        self.pk = id
        self.identifiant = identifiant
        self.nom_complet = nom_complet or identifiant
        self.roles = roles
        self.est_superadmin = est_superadmin

    def __str__(self):
        return self.nom_complet

    def a_le_role(self, *codes: str) -> bool:
        return self.est_superadmin or any(code in self.roles for code in codes)

    #: Roles qui valent « personnel interne » — au meme titre que le seul
    #: `ROLE_ADMIN` du modele Laravel d'origine. Le catalogue du hub distingue
    #: chef de chantier, ingenieur et controle qualite, une finesse que la
    #: logique metier ne reprend pas encore : les quatre comptent aujourd'hui
    #: comme un seul et meme niveau d'acces.
    ROLES_INTERNES = frozenset({"admin", "chef_chantier", "ingenieur", "controle_qualite"})

    @property
    def est_partenaire(self) -> bool:
        """Un partenaire, jamais un membre de l'equipe interne.

        Un compte auquel le hub aurait accorde a la fois « partenaire » et un
        role interne (mauvaise configuration, mais possible) est traite comme
        interne : mieux vaut lui laisser trop d'acces par erreur de saisie que
        de masquer par erreur des donnees a l'equipe qui les a produites.
        """
        if self.est_superadmin:
            return False
        return "partenaire" in self.roles and not (set(self.roles) & self.ROLES_INTERNES)

    @property
    def est_interne(self) -> bool:
        """Le complement exact de `est_partenaire`.

        Fidele au modele Laravel d'origine, ou `isAdmin()` designe en realite
        « n'importe quel compte non partenaire » : c'est cette meme regle,
        pas seulement le role « admin » au sens strict, qui gouverne la
        justification obligatoire d'une avancee et la purge de l'historique
        (cf. `services.py`, port de `TaskProgressRecorder`).
        """
        return not self.est_partenaire


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
                "Votre compte n'a pas acces au module Chantiers. "
                "Un administrateur de GDA Hub doit vous l'ouvrir."
            )

        try:
            identifiant_utilisateur = int(charge["sub"])
        except (KeyError, TypeError, ValueError) as erreur:
            raise exceptions.AuthenticationFailed("Jeton sans identifiant exploitable.") from erreur

        utilisateur = UtilisateurHub(
            id=identifiant_utilisateur,
            identifiant=charge.get("identifiant", ""),
            nom_complet=charge.get("nom_complet", ""),
            roles=roles,
            est_superadmin=est_superadmin,
        )
        return (utilisateur, jeton)

    def authenticate_header(self, requete):
        return self.mot_cle
