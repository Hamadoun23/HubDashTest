"""Configuration du backend GDA - Ressources Humaines et Finance."""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(cle, defaut=False):
    return os.getenv(cle, str(defaut)).lower() in {"1", "true", "yes", "oui"}


def env_list(cle, defaut=""):
    return [valeur.strip() for valeur in os.getenv(cle, defaut).split(",") if valeur.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-a-remplacer-en-production")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Tiers
    "rest_framework",
    "corsheaders",
    "django_filters",
    # Applications metier
    "core",
    "accounts",
    "rh",
    "finance",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
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
ASGI_APPLICATION = "config.asgi.application"

if os.getenv("DATABASE_URL", "").startswith("postgres"):
    import dj_database_url  # type: ignore[import-not-found]

    DATABASES = {"default": dj_database_url.parse(os.environ["DATABASE_URL"])}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.Utilisateur"

# Un agent se connecte avec son identifiant ou son adresse professionnelle.
AUTHENTICATION_BACKENDS = [
    "accounts.backends.IdentifiantOuEmailBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# En recette, des mots de passe triviaux (« 12345 ») facilitent les tests.
# La variable doit imperativement rester a False en production.
MOTS_DE_PASSE_SIMPLES = env_bool("DJANGO_MOTS_DE_PASSE_SIMPLES", DEBUG)

AUTH_PASSWORD_VALIDATORS = (
    []
    if MOTS_DE_PASSE_SIMPLES
    else [
        {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
        {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
        {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
        {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    ]
)

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Africa/Abidjan")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Les justificatifs sont servis en adresse absolue : DRF la construit a partir
# de la requete, et le navigateur la suit telle quelle. Servie a la racine,
# « media/ » convient. Servie sous /rh/ par la passerelle de GDA Hub, il faut
# le dire ici, sinon les pieces jointes pointent hors du perimetre de
# l'application et tombent sur la coquille du hub.
MEDIA_URL = os.environ.get("MEDIA_URL", "media/")
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Rattachement a GDA Hub -------------------------------------------------
#
# Absent en production : FinanceRH tourne alors seule, avec sa propre
# connexion, exactement comme aujourd'hui. Renseigne par la passerelle du hub,
# il autorise **en plus** le jeton du compte unique. Voir accounts/hub.py.
GDAHUB_JWKS_URL = os.environ.get("GDAHUB_JWKS_URL", "")
GDAHUB_JETON_EMETTEUR = os.environ.get("GDAHUB_JETON_EMETTEUR", "gdahub-identity")
GDAHUB_JETON_AUDIENCE = os.environ.get("GDAHUB_JETON_AUDIENCE", "gdahub")

REST_FRAMEWORK = {
    # L'ordre compte : la classe du hub rend la main des qu'elle voit un jeton
    # qui n'est pas le sien, et SimpleJWT reprend la main derriere elle.
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.hub.AuthentificationHub",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DATE_INPUT_FORMATS": ["%Y-%m-%d", "%d/%m/%Y"],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "60"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
