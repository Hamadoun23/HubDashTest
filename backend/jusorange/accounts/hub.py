"""Rattachement au compte unique de GDA Hub.

Jus d'orange tourne seule sur `jus.gdamali.net` avec sa propre connexion, et
cela ne change pas. Servie par la passerelle de GDA Hub, elle accepte **en
plus** le jeton signe par le service `identity` du hub : un agent se connecte
une fois et circule entre les applications sans ressaisir son mot de passe.

Trois regles gouvernent ce fichier.

**Le hub s'ajoute, il ne remplace pas.** Le jeton DRF et la session restent en
place. Si le hub tombe, Jus d'orange continue de fonctionner seule - sinon une
panne du hub arreterait toute l'entreprise, et le retour arriere deviendrait
impossible.

**Sans configuration, ce module est inerte.** Tant que `GDAHUB_JWKS_URL` est
absent - c'est le cas en production aujourd'hui - la classe rend la main
immediatement et rien ne change.

**Le hub donne une identite, pas une autorisation.** Un jeton valide qui ne
correspond a aucun compte de Jus d'orange est refuse, jamais transforme en
compte neuf : l'application attache ses droits a des groupes (production,
commerce, finance), et un compte cree a la volee n'en aurait aucun. Il verrait
donc l'application vide, sans comprendre pourquoi.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

#: Le code de cette application dans GDA Hub. C'est la cle sous
#: laquelle le jeton porte l'identifiant local de la personne.
APPLICATION = 'orange'

journal = logging.getLogger('jusorange.hub')

_CLIENT_JWKS = None


def _client_jwks():
    """Le client JWKS, construit une seule fois.

    Les cles publiques changent rarement ; PyJWT les met en cache de lui-meme.
    Le construire a chaque requete rouvrirait une connexion vers `identity`
    pour rien.
    """
    global _CLIENT_JWKS
    if _CLIENT_JWKS is None:
        from jwt import PyJWKClient

        _CLIENT_JWKS = PyJWKClient(settings.GDAHUB_JWKS_URL, cache_keys=True)
    return _CLIENT_JWKS


class AuthentificationHub(authentication.BaseAuthentication):
    """Accepte le jeton RS256 signe par le service `identity` du hub."""

    mot_cle = 'Bearer'

    def authenticate(self, requete):
        if not getattr(settings, 'GDAHUB_JWKS_URL', ''):
            return None

        entete = authentication.get_authorization_header(requete).split()
        if len(entete) != 2 or entete[0].lower() != self.mot_cle.lower().encode():
            return None

        jeton = entete[1].decode()

        import jwt

        # Le jeton du hub est signe par une cle privee (RS256). Tout le reste
        # - a commencer par le jeton DRF, qui n'est meme pas un JWT - est
        # rendu aux classes suivantes.
        try:
            entetes = jwt.get_unverified_header(jeton)
        except jwt.PyJWTError:
            return None
        if entetes.get('alg') != 'RS256':
            return None

        try:
            cle = _client_jwks().get_signing_key_from_jwt(jeton)
            charge = jwt.decode(
                jeton,
                cle.key,
                algorithms=['RS256'],
                issuer=settings.GDAHUB_JETON_EMETTEUR,
                audience=settings.GDAHUB_JETON_AUDIENCE,
            )
        except jwt.PyJWTError as erreur:
            raise exceptions.AuthenticationFailed(
                "Le jeton de GDA Hub n'a pas pu etre verifie."
            ) from erreur

        # Le hub identifie par l'adresse professionnelle ; cette
        # application peut connaitre la personne sous un autre nom.
        # La correspondance, quand elle existe, prime sur l'adresse.
        locaux = charge.get('identifiants_locaux') or {}
        identifiant = (
            locaux.get(APPLICATION) or charge.get('identifiant') or ''
        ).strip().lower()
        if not identifiant:
            raise exceptions.AuthenticationFailed('Jeton sans identifiant.')

        modele = get_user_model()
        compte = (
            modele.objects.filter(email__iexact=identifiant).first()
            or modele.objects.filter(username__iexact=identifiant).first()
        )
        if compte is None:
            journal.warning(
                "Jeton du hub valide pour « %s », mais aucun compte ne porte "
                "cette adresse dans Jus d'orange.",
                identifiant,
            )
            raise exceptions.AuthenticationFailed(
                "Votre compte GDA Hub n'est rattache a aucun utilisateur de "
                "Jus d'orange. Demandez votre acces au responsable."
            )
        if not compte.is_active:
            raise exceptions.AuthenticationFailed('Ce compte est desactive.')

        return (compte, jeton)

    def authenticate_header(self, requete):
        return self.mot_cle
