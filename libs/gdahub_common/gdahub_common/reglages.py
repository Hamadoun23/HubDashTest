"""Reglages Django communs a tous les services GDA Hub.

Le fichier de reglages d'un service commence par :

    from gdahub_common.reglages import *  # noqa: F403

puis ne declare que ce qui lui est propre : son application, ses apps Django,
son module d'URL. Tout le reste — base de donnees, authentification, format
d'erreur, pagination, langue, CORS — est identique partout et se corrige ici
une seule fois.
"""

import os
from pathlib import Path

import dj_database_url


def _booleen(nom: str, defaut: str = "False") -> bool:
    return os.environ.get(nom, defaut).strip().lower() in {"1", "true", "yes", "oui"}


def _liste(nom: str, defaut: str = "") -> list[str]:
    brut = os.environ.get(nom, defaut)
    return [element.strip() for element in brut.split(",") if element.strip()]


# Le service qui importe ce module ; ses propres chemins priment.
BASE_DIR = Path(os.environ.get("DJANGO_BASE_DIR", ".")).resolve()

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "developpement-local-non-secret")
DEBUG = _booleen("DJANGO_DEBUG", "False")
ALLOWED_HOSTS = _liste("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0")

# Code de l'application portee par ce service : « bdm », « orange », « daily »,
# « planning », « identity ». Il sert a lire les habilitations dans le jeton.
GDAHUB_APPLICATION = os.environ.get("GDAHUB_APPLICATION", "")

# Ou trouver les cles publiques d'identity, et comment lire ses jetons.
GDAHUB_JWKS_URL = os.environ.get(
    "GDAHUB_JWKS_URL", "http://identity:8000/.well-known/jwks.json"
)
GDAHUB_JWKS_DUREE_CACHE = int(os.environ.get("GDAHUB_JWKS_DUREE_CACHE", "300"))
GDAHUB_JETON_EMETTEUR = os.environ.get("GDAHUB_JETON_EMETTEUR", "gdahub-identity")
GDAHUB_JETON_AUDIENCE = os.environ.get("GDAHUB_JETON_AUDIENCE", "gdahub")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "django_filters",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    }
]

# Sans DATABASE_URL (développement local sans Postgres), on retombe sur
# SQLite plutôt que de laisser dj_database_url échouer sur une URL vide —
# même convention que les services qui gèrent leur DATABASES eux-mêmes
# (voir backend/financerh/config/settings.py).
if os.environ.get("DATABASE_URL", "").startswith("postgres"):
    DATABASES = {
        "default": dj_database_url.config(
            default=os.environ["DATABASE_URL"],
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "gdahub_common.auth.AuthentificationJeton",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "gdahub_common.permissions.EstHabilite",
    ],
    "DEFAULT_PAGINATION_CLASS": "gdahub_common.pagination.PaginationGdaHub",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "EXCEPTION_HANDLER": "gdahub_common.exceptions.gestionnaire",
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

# Le navigateur parle a la passerelle, jamais aux services directement ; en
# developpement il joint aussi les ports publies, d'ou la liste.
CORS_ALLOWED_ORIGINS = _liste(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
)
CORS_ALLOW_CREDENTIALS = True

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = os.environ.get("DJANGO_TIME_ZONE", "Africa/Bamako")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

# Chaque service range ses fichiers dans son propre volume, mais le navigateur
# ne voit qu'une seule origine : sans prefixe par service, le « justificatifs/ »
# des ressources humaines et celui de la finance designeraient la meme adresse.
# C'est ce prefixe que la passerelle route vers le bon volume.
MEDIA_URL = f"media/{GDAHUB_APPLICATION or 'commun'}/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"gdahub": {"level": "INFO", "propagate": True}},
}
