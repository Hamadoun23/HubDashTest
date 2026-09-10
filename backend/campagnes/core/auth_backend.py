"""
Authentification contre les hachages bcrypt produits par Laravel.

Laravel stocke `$2y$12$…`. Django attend `algorithme$…` et refuserait la valeur
telle quelle. Plutôt que de réécrire la colonne `password` — ce qui interdirait
tout retour arrière vers Laravel — on vérifie le hachage brut avec bcrypt.

`$2y$` (PHP) et `$2b$` (référence) désignent le même algorithme : seul le
préfixe diffère, la vérification est identique après substitution. Les hachages
que nous produisons sont réécrits en `$2y$` afin que la colonne reste lisible
par Laravel dans les deux sens pendant toute la période de bascule.

L'identifiant de connexion n'est pas seulement l'e-mail : cf. `trouver_par_identifiant`.
"""

import bcrypt
from django.contrib.auth.backends import BaseBackend
from django.db.models import Q, functions

from .models import ROLES_COMMERCIAUX, Role, User

#: Laravel utilise BCRYPT_ROUNDS=12 (cf. .env).
BCRYPT_ROUNDS = 12

#: Hachage inerte servant à égaliser le temps de réponse quand le compte n'existe pas.
_HACHAGE_FACTICE = bcrypt.hashpw(b"-", bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()

#: Rôles soumis au contrôle du drapeau `actif`. Les administrateurs en sont
#: exclus : un admin désactivé conserve l'accès (comportement Laravel actuel).
ROLES_SOUMIS_AU_DRAPEAU_ACTIF = [*ROLES_COMMERCIAUX, Role.DIRECTION]

MESSAGE_ECHEC = "Ces identifiants ne correspondent à aucun compte."
MESSAGE_COMPTE_DESACTIVE = "Votre compte est désactivé. Contactez l'administration."


def verifier_mot_de_passe(mot_de_passe: str, hachage: str) -> bool:
    """Vérifie un mot de passe en clair contre un hachage bcrypt Laravel."""
    if not mot_de_passe or not hachage:
        return False

    # bcrypt tronque silencieusement au-delà de 72 octets : on refuse plutôt que
    # d'accepter un mot de passe amputé.
    encoded = mot_de_passe.encode("utf-8")
    if len(encoded) > 72:
        return False

    if hachage.startswith("$2y$"):
        hachage = "$2b$" + hachage[4:]

    if not hachage.startswith(("$2a$", "$2b$", "$2x$")):
        return False

    try:
        return bcrypt.checkpw(encoded, hachage.encode("utf-8"))
    except ValueError:
        return False


def hacher_mot_de_passe(mot_de_passe: str) -> str:
    """Produit un hachage au format Laravel (`$2y$`), relisible par les deux stacks."""
    hachage = bcrypt.hashpw(
        mot_de_passe.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    ).decode("utf-8")
    return "$2y$" + hachage[4:]


def trouver_par_identifiant(identifiant: str):
    """
    Résout l'identifiant saisi, dans l'ordre admis par Laravel
    (App\\Http\\Requests\\Auth\\LoginRequest) :

    - e-mail exact ;
    - numéro de téléphone exact ;
    - nom complet, insensible à la casse et aux espaces, mais réservé aux
      comptes `admin` et `direction`.
    """
    identifiant = (identifiant or "").strip()
    if not identifiant:
        return None

    return (
        User.objects.select_related("agence")
        .annotate(nom_normalise=functions.Lower(functions.Trim("name")))
        .filter(
            Q(email=identifiant)
            | Q(telephone=identifiant)
            | (
                Q(role__in=[Role.ADMIN, Role.DIRECTION])
                & Q(nom_normalise=identifiant.lower())
            )
        )
        .first()
    )


def compte_desactive(user) -> bool:
    """Le compte est-il bloqué par le drapeau `actif` ? Les admins y échappent."""
    return user.role in ROLES_SOUMIS_AU_DRAPEAU_ACTIF and not user.actif


class LaravelBcryptBackend(BaseBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        identifiant = username or kwargs.get("email")
        if not identifiant or not password:
            return None

        user = trouver_par_identifiant(identifiant)
        if user is None:
            verifier_mot_de_passe(password, _HACHAGE_FACTICE)
            return None

        if not verifier_mot_de_passe(password, user.password):
            return None

        return user

    def user_can_authenticate(self, user):
        return bool(user) and not compte_desactive(user)

    def get_user(self, user_id):
        try:
            return User.objects.select_related("agence").get(pk=user_id)
        except User.DoesNotExist:
            return None
