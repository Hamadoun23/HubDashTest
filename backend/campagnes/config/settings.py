"""
Configuration Django — migration du backend Laravel de BDM.

Bascule Postgres (voir contexte.md) : les modèles métier, longtemps en
`managed = False` pour coller au schéma MySQL de Laravel au caractère près,
sont repassés en `managed = True` et ont leurs propres migrations Django —
la compatibilité avec un futur dump MySQL de production est abandonnée au
profit d'un schéma géré nativement par Django sur Postgres.

`USE_TZ = False` reste inchangé : Laravel tournait en UTC (config/app.php) et
écrivait des datetimes naïfs ; le reste du code (filtres `__date`, etc.)
suppose toujours des datetimes naïfs.
"""

from pathlib import Path

from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")


def env(name, default=None):
    return os.environ.get(name, default)


def env_bool(name, default=False):
    return str(env(name, str(default))).strip().lower() in ("1", "true", "yes", "on")


APP_NAME = env("APP_NAME", "Campagne BDM").strip('"')

SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]


# --------------------------------------------------------------------------
# Applications
# --------------------------------------------------------------------------
# Volontairement sans django.contrib.admin : l'administration métier est déjà
# assurée par les écrans React repris de Laravel.

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "inertia",
    "core",
    "campagnes",
    "terrain",
    "rapports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Tout en haut : il corrige les redirections en sortie, et doit donc voir
    # passer celles de tous les middlewares qui suivent.
    "core.prefixe.PrefixeDeService",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    # Avant le CSRF : celui-ci lit request.POST, qui doit déjà contenir le
    # corps JSON envoyé par Inertia.
    "core.middleware.CorpsJsonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Juste après : la session doit exister pour que le compte unique de GDA
    # Hub puisse l'ouvrir, et le rôle doit être connu de la garde qui suit.
    "core.hub.AuthentificationHub",
    # Après l'authentification : la garde a besoin de connaître le rôle.
    "core.middleware.ChoixClientRequisMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "inertia.middleware.InertiaMiddleware",
    "core.middleware.InertiaSharedDataMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Laravel n'ajoute pas de slash final aux URLs. On aligne Django pour que les
# URLs soient identiques au caractère près (favoris, PWA, liens partagés) et
# pour que la table de routes envoyée au JS reste exacte.
APPEND_SLASH = False

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "core.context_processors.app_context",
            ],
        },
    },
]


# --------------------------------------------------------------------------
# Base de données
# --------------------------------------------------------------------------

# Postgres via DATABASE_URL (Docker — voir docker-compose.yml), même
# convention que les autres services du hub (backend/financerh/config/
# settings.py). Sans DATABASE_URL (dev local hors Docker), on retombe sur
# SQLite.
if env("DATABASE_URL", "").startswith("postgres"):
    import dj_database_url

    DATABASES = {"default": dj_database_url.parse(env("DATABASE_URL"))}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --------------------------------------------------------------------------
# Authentification
# --------------------------------------------------------------------------

# Sous quel chemin l'application est servie.
#
# Vide en production sur `bdm.gdamali.net` : BDM est a la racine et rien ne
# change. Servie par la passerelle de GDA Hub, cette variable vaut « /campagnes ».
# `FORCE_SCRIPT_NAME` est ce qui apprend a Django que ses propres adresses
# — celles de `reverse()`, des redirections apres connexion, des formulaires
# — commencent par ce prefixe. Sans lui, chaque redirection sortirait du
# perimetre de l'application et tomberait sur la coquille du hub.
CHEMIN_BASE = os.environ.get("CHEMIN_BASE", "").rstrip("/")
if CHEMIN_BASE:
    FORCE_SCRIPT_NAME = CHEMIN_BASE

LOGIN_URL = f"{CHEMIN_BASE}/login"
LOGIN_REDIRECT_URL = f"{CHEMIN_BASE}/dashboard"
LOGOUT_REDIRECT_URL = f"{CHEMIN_BASE}/login"

AUTH_USER_MODEL = "core.User"

# Le backend maison lit les hachages bcrypt de Laravel (`$2y$…`) tels quels,
# sans réécrire la colonne : voir core/auth_backend.py.
AUTHENTICATION_BACKENDS = ["core.auth_backend.LaravelBcryptBackend"]

# Derriere la passerelle de GDA Hub, toutes les applications partagent une
# seule origine — et donc un seul espace de cookies. Deux Django qui posent
# tous les deux « sessionid » se deconnecteraient mutuellement a chaque
# navigation. D'ou un nom propre a BDM, et un chemin qui borne sa portee.
SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "sessionid")
CSRF_COOKIE_NAME = os.environ.get("CSRF_COOKIE_NAME", "csrftoken")

# Chemin des cookies : par defaut celui de CHEMIN_BASE, car la vraie
# passerelle sert la page ET l'API sous le meme sous-chemin. Le hub GDA, lui,
# sert sa page React a la racine (SPA en HashRouter) et ne proxifie que l'API
# sous /campagnes : le cookie doit alors rester visible a la racine, d'ou cet
# override explicite plutot que de le deriver de CHEMIN_BASE.
SESSION_COOKIE_PATH = os.environ.get("SESSION_COOKIE_PATH") or (f"{CHEMIN_BASE}/" if CHEMIN_BASE else "/")
CSRF_COOKIE_PATH = os.environ.get("CSRF_COOKIE_PATH") or (f"{CHEMIN_BASE}/" if CHEMIN_BASE else "/")

# Laravel : SESSION_LIFETIME=120 (minutes), expire_on_close = false.
SESSION_COOKIE_AGE = 120 * 60
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_SAVE_EVERY_REQUEST = True

# --- Rattachement a GDA Hub ---
#
# Absent en production : BDM tourne alors seule, avec sa propre connexion.
# Renseigne par la passerelle du hub, il autorise **en plus** le compte
# unique. Voir core/hub.py.
GDAHUB_JWKS_URL = os.environ.get("GDAHUB_JWKS_URL", "")
GDAHUB_JETON_EMETTEUR = os.environ.get("GDAHUB_JETON_EMETTEUR", "gdahub-identity")
GDAHUB_JETON_AUDIENCE = os.environ.get("GDAHUB_JETON_AUDIENCE", "gdahub")

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# --------------------------------------------------------------------------
# Internationalisation — aligné sur Laravel (fr, UTC, datetimes naïfs)
# --------------------------------------------------------------------------

LANGUAGE_CODE = "fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = False


# --------------------------------------------------------------------------
# Fichiers statiques
# --------------------------------------------------------------------------

STATIC_URL = f"{CHEMIN_BASE}/static/"
STATICFILES_DIRS = [
    BASE_DIR / "static",
    REPO_DIR / "campagnes-frontend" / "dist",
]
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = f"{CHEMIN_BASE}/storage/"
MEDIA_ROOT = BASE_DIR / "media"


# --------------------------------------------------------------------------
# Inertia
# --------------------------------------------------------------------------

INERTIA_LAYOUT = "app.html"

# Serveur de développement Vite : en dev les assets sont servis par Vite
# (HMR), en production ils sont lus dans frontend/dist via le manifeste.
VITE_DEV = env_bool("VITE_DEV", DEBUG)
VITE_DEV_SERVER = env("VITE_DEV_SERVER", "http://localhost:5173")
VITE_MANIFEST_PATH = REPO_DIR / "campagnes-frontend" / "dist" / ".vite" / "manifest.json"

# En dev, le serveur Vite est une origine distincte de Django — que ce soit
# le Vite natif de ce dépôt (8000/8001) ou celui du hub GDA, qui proxifie
# /campagnes vers ce service en conservant l'origine du navigateur (5173).
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8001",
    "http://127.0.0.1:8001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


# --------------------------------------------------------------------------
# Durcissement de production
# --------------------------------------------------------------------------

if not DEBUG:
    # Derrière le nginx de l'hôte : sans cet en-tête, Django croirait toutes
    # les requêtes en HTTP et refuserait de poser les cookies sécurisés.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True

    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"

    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"

    CSRF_TRUSTED_ORIGINS = [f"https://{hote}" for hote in ALLOWED_HOSTS if hote != "*"]

    # Le cache par défaut est local au processus : avec plusieurs workers
    # gunicorn, la limitation des tentatives de connexion ne serait pas
    # partagée entre eux. On passe donc par la base.
    #
    # `django_cache` est une table technique supplémentaire, au schéma propre à
    # Django (celle de Laravel n'est pas compatible). Elle est créée une fois
    # par `manage.py createcachetable`, comme indiqué dans la procédure de
    # bascule.
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
            "LOCATION": "django_cache",
        }
    }

MESSAGE_STORAGE = "django.contrib.messages.storage.session.SessionStorage"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
