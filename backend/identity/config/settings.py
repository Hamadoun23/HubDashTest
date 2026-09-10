"""Reglages du service identity.

Identity est le seul service qui possede une table d'utilisateurs et le seul
qui signe des jetons. Il embarque donc django.contrib.auth — pour le hachage
des mots de passe et l'administration — la ou les autres services n'ont que
le strict necessaire.
"""

from pathlib import Path

from gdahub_common.reglages import *  # noqa: F403
from gdahub_common.reglages import (
    INSTALLED_APPS,
    _liste,
    MIDDLEWARE,
    REST_FRAMEWORK,
    TEMPLATES,
)

import os

BASE_DIR = Path(__file__).resolve().parent.parent

# Identity se protege avec ses propres jetons : « hub » est l'application des
# fonctions transverses (annuaire des comptes, habilitations, journal).
GDAHUB_APPLICATION = "hub"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    *INSTALLED_APPS,
    "comptes",
]

MIDDLEWARE = [
    *MIDDLEWARE,
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

TEMPLATES[0]["OPTIONS"]["context_processors"] = [
    "django.template.context_processors.request",
    "django.contrib.auth.context_processors.auth",
    "django.contrib.messages.context_processors.messages",
]

AUTH_USER_MODEL = "comptes.Utilisateur"

# L'administration Django est servie derriere la passerelle : Django doit
# reconnaitre l'origine du navigateur, port compris, sans quoi la connexion
# est refusee au titre de la protection CSRF.
CSRF_TRUSTED_ORIGINS = _liste(  # noqa: F405
    "DJANGO_ORIGINES_SURES",
    "http://localhost:8080,http://127.0.0.1:8080,http://localhost:8101",
)

MEDIA_URL = os.environ.get("MEDIA_URL", "media/hub/")
MEDIA_ROOT = BASE_DIR / "media"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- Signature des jetons -------------------------------------------------
# La cle privee ne quitte jamais ce service ; les autres ne connaissent que la
# cle publique, publiee sur /.well-known/jwks.json.
GDAHUB_DOSSIER_CLES = Path(os.environ.get("GDAHUB_DOSSIER_CLES", "/cles"))
GDAHUB_JETON_EMETTEUR = os.environ.get("GDAHUB_JETON_EMETTEUR", "gdahub-identity")
GDAHUB_JETON_AUDIENCE = os.environ.get("GDAHUB_JETON_AUDIENCE", "gdahub")
GDAHUB_DUREE_ACCES = int(os.environ.get("GDAHUB_DUREE_ACCES", "900"))  # 15 min
GDAHUB_DUREE_RAFRAICHISSEMENT = int(
    os.environ.get("GDAHUB_DUREE_RAFRAICHISSEMENT", "604800")
)  # 7 jours

# Identity verifie ses propres jetons avec sa cle privee, sans appel reseau :
# la classe ci-dessous remplace celle du socle. L'URL reste declaree pour les
# outils qui la lisent, mais ce service ne s'en sert pas.
GDAHUB_JWKS_URL = os.environ.get(
    "GDAHUB_JWKS_URL", "http://localhost:8000/.well-known/jwks.json"
)

# Le super administrateur cree au premier demarrage. Ce n'est pas un compte
# de service anonyme mais le responsable IT du groupe : le journal des
# connexions reste lisible des la premiere seance.
GDAHUB_ADMIN_IDENTIFIANT = os.environ.get(
    "GDAHUB_ADMIN_IDENTIFIANT", "hcisse@gdamali.net"
)
GDAHUB_ADMIN_MOT_DE_PASSE = os.environ.get("GDAHUB_ADMIN_MOT_DE_PASSE", "admin")
GDAHUB_ADMIN_NOM = os.environ.get("GDAHUB_ADMIN_NOM", "Cisse")
GDAHUB_ADMIN_PRENOM = os.environ.get("GDAHUB_ADMIN_PRENOM", "Hamadoun")
GDAHUB_ADMIN_FONCTION = os.environ.get(
    "GDAHUB_ADMIN_FONCTION", "Responsable IT et developpement"
)

AUTH_PASSWORD_VALIDATORS = (
    []
    if os.environ.get("DJANGO_MOTS_DE_PASSE_SIMPLES", "False").lower() == "true"
    else [
        {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
        {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
        {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
        {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    ]
)

# La route de connexion est la seule porte ouverte sans jeton : on la limite
# pour qu'un essai de mots de passe en rafale ne passe pas inapercu.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "connexion": os.environ.get("GDAHUB_LIMITE_CONNEXION", "10/min")
    },
}

# Identity possede la cle : il n'a pas a la demander a lui-meme par HTTP.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "comptes.authentification.AuthentificationLocale"
    ],
}
