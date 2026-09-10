"""Identity verifie ses jetons sans passer par le reseau.

Les autres services vont chercher la cle publique sur le JWKS : ils n'ont pas
le choix, ils ne la possedent pas. Identity, lui, l'a sous la main. Le faire
passer par un appel HTTP a lui-meme ajouterait une requete a chaque page, et
rendrait le service dependant de sa propre disponibilite reseau — un
enchevetrement dont on se passe.
"""

from __future__ import annotations

import jwt
from gdahub_common.identite import UtilisateurJeton
from rest_framework import authentication, exceptions

from comptes import jetons


class AuthentificationLocale(authentication.BaseAuthentication):
    """Meme contrat que `gdahub_common.auth`, sans le detour par le JWKS."""

    mot_cle = "Bearer"
    application = "hub"

    def authenticate(self, requete):
        entete = authentication.get_authorization_header(requete).split()
        if not entete or entete[0].decode().lower() != self.mot_cle.lower():
            return None
        if len(entete) != 2:
            raise exceptions.AuthenticationFailed(
                "En-tete Authorization mal forme : attendu « Bearer <jeton> »."
            )

        brut = entete[1].decode()
        try:
            charge = jetons.lire(brut, "access")
        except jwt.ExpiredSignatureError as erreur:
            raise exceptions.AuthenticationFailed("Jeton expire.") from erreur
        except jwt.InvalidTokenError as erreur:
            raise exceptions.AuthenticationFailed(
                f"Jeton invalide : {erreur}"
            ) from erreur

        habilitations = charge.get("habilitations") or {}
        utilisateur = UtilisateurJeton(
            id=int(charge["sub"]),
            identifiant=charge.get("identifiant", ""),
            nom_complet=charge.get("nom_complet", ""),
            email=charge.get("email", ""),
            est_superadmin=bool(charge.get("est_superadmin")),
            roles=list(habilitations.get(self.application, [])),
            habilitations=habilitations,
            jeton=brut,
        )
        return (utilisateur, brut)

    def authenticate_header(self, requete):
        return self.mot_cle
