"""Authentification par identifiant **ou** adresse professionnelle.

Un agent retient son adresse mieux que son identifiant : les deux ouvrent donc
la session. L'identifiant reste prioritaire — si une adresse coincidait avec
l'identifiant d'un autre agent, c'est le titulaire de l'identifiant qui
l'emporte, jamais l'inverse.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class IdentifiantOuEmailBackend(ModelBackend):
    """Resout l'identifiant saisi, puis delegue la verification au socle Django."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        saisie = (username or kwargs.get(get_user_model().USERNAME_FIELD) or "").strip()
        if not saisie or password is None:
            return None

        modele = get_user_model()
        agent = (
            modele.objects.filter(username__iexact=saisie).first()
            or modele.objects.filter(email__iexact=saisie).first()
        )
        if agent is None:
            # Une saisie inconnue doit couter le meme temps qu'un mot de passe
            # faux : sans ce hachage a vide, la duree de la reponse revelerait
            # quels identifiants existent.
            modele().set_password(password)
            return None

        if agent.check_password(password) and self.user_can_authenticate(agent):
            return agent
        return None
