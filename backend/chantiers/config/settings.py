"""Reglages du service Chantiers (module « daily » du hub GDA).

Ce service n'a jamais ete deploye sous une autre forme que la reecriture
d'un stagiaire, jamais mise en production (cf. PLAN.md du hub). Contrairement
a FinanceRH, Jus d'orange ou BDM, il ne porte donc aucun heritage de comptes
locaux a preserver : l'authentification passe **exclusivement** par le jeton
RS256 du hub (voir `chantiers/hub.py`). Il n'y a pas de connexion de secours
a cote, parce qu'il n'y a jamais eu de connexion a lui tout seul.

Le compte Django `contrib.auth` reste present, mais seulement pour
`/admin/` — l'outillage d'exploitation, pas le chemin des utilisateurs.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-chantiers-developpement-local-uniquement",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h]
if DEBUG and not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "modeltranslation",
    "chantiers.apps.ChantiersConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --------------------------------------------------------------------------
# Base de donnees — une par service, jamais partagee.
# --------------------------------------------------------------------------
if os.environ.get("DATABASE_URL"):
    import dj_database_url

    DATABASES = {
        "default": dj_database_url.config(
            conn_max_age=600,
            ssl_require=os.environ.get("DB_SSL_REQUIRE", "False").lower()
            in ("true", "1", "yes"),
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# --------------------------------------------------------------------------
# Compte unique de GDA Hub — la seule porte d'entree de ce service.
# --------------------------------------------------------------------------
GDAHUB_JWKS_URL = os.environ.get("GDAHUB_JWKS_URL", "")
GDAHUB_JETON_EMETTEUR = os.environ.get("GDAHUB_JETON_EMETTEUR", "gdahub-identity")
GDAHUB_JETON_AUDIENCE = os.environ.get("GDAHUB_JETON_AUDIENCE", "gdahub")

# Le code sous lequel identity connait cette application. Le service
# s'appelle « chantiers » (dossier, base de donnees, chemin /chantiers),
# mais son code dans le catalogue des applications est « daily » — c'est
# sous cette cle que le jeton porte les habilitations. Les deux noms
# coexistent pour une raison historique (l'app Laravel s'appelait DailyGda)
# et il ne faut pas les confondre : chercher "chantiers" dans le jeton ne
# trouverait jamais rien.
CODE_APPLICATION = "daily"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "chantiers.hub.AuthentificationHub",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
    ],
}

CORS_ALLOWED_ORIGINS = [
    o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o
]
CORS_ALLOW_CREDENTIALS = True

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr"
# django-modeltranslation exige au moins deux langues declarees des que des
# champs sont enregistres pour la traduction (voir chantiers/translation.py) ;
# l'anglais n'est pas utilise aujourd'hui mais la colonne existe en base.
LANGUAGES = [("fr", "Francais"), ("en", "English")]
MODELTRANSLATION_DEFAULT_LANGUAGE = "fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Les photos de chantier sont servies en adresse absolue : sans ce prefixe,
# servies sous /chantiers/ elles pointeraient hors du perimetre de
# l'application, exactement comme cela a ete corrige pour FinanceRH et Jus.
MEDIA_URL = os.environ.get("MEDIA_URL", "/media/chantiers/")
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "media"))

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# L'admin Django sert de console d'exploitation (corriger une donnee, inspecter
# le journal d'activite) — pas de connexion applicative par ce chemin.
LOGIN_URL = "admin:login"
