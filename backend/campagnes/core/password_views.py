"""
Réinitialisation de mot de passe et vérification d'e-mail.

Portage de routes/auth.php et des contrôleurs Auth de Laravel Breeze.

Le mailer de l'application est configuré sur `log` : Laravel n'envoie donc
aucun courriel, il écrit le lien dans les journaux. On reproduit ce
comportement plutôt que d'introduire un envoi SMTP qui n'existe pas côté
Laravel — ce serait un changement fonctionnel, pas une migration.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta

from django.db import connection
from django.shortcuts import redirect
from inertia import render

from .auth_backend import hacher_mot_de_passe, verifier_mot_de_passe
from .decorators import http_methods
from .middleware import deposer_flash, retour_avec_erreurs
from .models import User

journal = logging.getLogger(__name__)

#: Durée de validité d'un lien de réinitialisation (config/auth.php : 60 minutes).
VALIDITE_MINUTES = 60

MESSAGE_LIEN_ENVOYE = "Nous vous avons envoyé par e-mail le lien de réinitialisation du mot de passe."
MESSAGE_UTILISATEUR_INCONNU = "Aucun utilisateur n'a été trouvé avec cette adresse e-mail."
MESSAGE_JETON_INVALIDE = "Ce jeton de réinitialisation du mot de passe n'est pas valide."
MESSAGE_REINITIALISE = "Votre mot de passe a été réinitialisé."


def _empreinte(jeton: str) -> str:
    """
    Empreinte stockée en base.

    Laravel hache le jeton avec bcrypt ; on conserve la même colonne et la même
    logique de vérification via le hachage bcrypt commun aux deux stacks.
    """
    return hacher_mot_de_passe(jeton)


def _enregistrer_jeton(email: str, jeton: str) -> None:
    maintenant = datetime.now().replace(microsecond=0)
    with connection.cursor() as curseur:
        curseur.execute(
            "REPLACE INTO password_reset_tokens (email, token, created_at) VALUES (%s, %s, %s)",
            [email, _empreinte(jeton), maintenant],
        )


def _lire_jeton(email: str):
    with connection.cursor() as curseur:
        curseur.execute(
            "SELECT token, created_at FROM password_reset_tokens WHERE email = %s",
            [email],
        )
        return curseur.fetchone()


def _supprimer_jeton(email: str) -> None:
    with connection.cursor() as curseur:
        curseur.execute("DELETE FROM password_reset_tokens WHERE email = %s", [email])


def _rediriger_si_connecte(request):
    """Middleware `guest` de Laravel : un compte connecté n'a rien à faire ici."""
    return redirect("/dashboard") if request.user.is_authenticated else None


@http_methods("GET", "HEAD", "POST")
def mot_de_passe_oublie(request):
    """GET : formulaire. POST : génération et « envoi » du lien."""
    redirection = _rediriger_si_connecte(request)
    if redirection:
        return redirection
    if request.method != "POST":
        return render(
            request,
            "Auth/ForgotPassword",
            {"status": request.session.pop("status", None)},
        )

    email = (request.POST.get("email") or "").strip()
    if not email:
        return retour_avec_erreurs(request, {"email": "Le champ email est obligatoire."})

    utilisateur = User.objects.filter(email__iexact=email).first()
    if utilisateur is None:
        return retour_avec_erreurs(request, {"email": MESSAGE_UTILISATEUR_INCONNU})

    jeton = secrets.token_hex(32)
    _enregistrer_jeton(utilisateur.email, jeton)

    lien = request.build_absolute_uri(
        f"/reset-password/{jeton}?email={utilisateur.email}"
    )
    journal.info("Lien de réinitialisation pour %s : %s", utilisateur.email, lien)

    request.session["status"] = MESSAGE_LIEN_ENVOYE
    return redirect("/forgot-password")


@http_methods("GET", "HEAD")
def reinitialiser_formulaire(request, token):
    redirection = _rediriger_si_connecte(request)
    if redirection:
        return redirection
    return render(
        request,
        "Auth/ResetPassword",
        {"token": token, "email": request.GET.get("email")},
    )


@http_methods("POST")
def reinitialiser_appliquer(request):
    redirection = _rediriger_si_connecte(request)
    if redirection:
        return redirection
    email = (request.POST.get("email") or "").strip()
    jeton = request.POST.get("token") or ""
    mot_de_passe = request.POST.get("password") or ""

    if len(mot_de_passe) < 8:
        return retour_avec_erreurs(
            request,
            {"password": "Le texte de password doit contenir au moins 8 caractères."},
        )
    if mot_de_passe != request.POST.get("password_confirmation"):
        return retour_avec_erreurs(
            request, {"password": "Le champ de confirmation password ne correspond pas."}
        )

    ligne = _lire_jeton(email)
    utilisateur = User.objects.filter(email__iexact=email).first()

    if ligne is None or utilisateur is None or not verifier_mot_de_passe(jeton, ligne[0]):
        return retour_avec_erreurs(request, {"email": MESSAGE_JETON_INVALIDE})

    # Un lien périmé ne doit plus permettre de reprendre la main sur le compte.
    cree_le = ligne[1]
    if cree_le and cree_le < datetime.now() - timedelta(minutes=VALIDITE_MINUTES):
        _supprimer_jeton(email)
        return retour_avec_erreurs(request, {"email": MESSAGE_JETON_INVALIDE})

    utilisateur.password = hacher_mot_de_passe(mot_de_passe)
    utilisateur.remember_token = secrets.token_urlsafe(45)[:60]
    utilisateur.save(update_fields=["password", "remember_token"])
    _supprimer_jeton(email)

    request.session["status"] = MESSAGE_REINITIALISE
    return redirect("/login")


@http_methods("GET", "HEAD", "POST")
def confirmer_mot_de_passe(request):
    """Ré-authentification avant une action sensible."""
    if request.method != "POST":
        return render(request, "Auth/ConfirmPassword", {})

    if not verifier_mot_de_passe(
        request.POST.get("password") or "", request.user.password
    ):
        return retour_avec_erreurs(
            request, {"password": "Le mot de passe fourni est incorrect."}
        )

    request.session["auth.password_confirmed_at"] = datetime.now().isoformat()
    return redirect("/dashboard")


# ---------------------------------------------------------------------------
# Vérification d'adresse e-mail
# ---------------------------------------------------------------------------


def _empreinte_email(email: str) -> str:
    """Empreinte sha1 de l'adresse, comme dans le lien signé de Laravel."""
    return hashlib.sha1((email or "").encode("utf-8")).hexdigest()


@http_methods("GET", "HEAD")
def verification_notice(request):
    if not request.user.is_authenticated:
        from django.contrib.auth.views import redirect_to_login

        return redirect_to_login(request.get_full_path())
    if request.user.email_verified_at:
        return redirect("/dashboard")
    return render(
        request,
        "Auth/VerifyEmail",
        {"status": request.session.pop("status", None)},
    )


@http_methods("GET", "HEAD")
def verification_verify(request, id, hash):
    utilisateur = User.objects.filter(pk=id).first()
    if utilisateur is None or _empreinte_email(utilisateur.email) != hash:
        from django.core.exceptions import PermissionDenied

        raise PermissionDenied

    if not utilisateur.email_verified_at:
        utilisateur.email_verified_at = datetime.now().replace(microsecond=0)
        utilisateur.save(update_fields=["email_verified_at"])

    return redirect("/dashboard?verified=1")


@http_methods("POST")
def verification_send(request):
    utilisateur = request.user
    if utilisateur.is_authenticated and not utilisateur.email_verified_at:
        lien = request.build_absolute_uri(
            f"/verify-email/{utilisateur.id}/{_empreinte_email(utilisateur.email)}"
        )
        journal.info("Lien de vérification pour %s : %s", utilisateur.email, lien)
        deposer_flash(request, status="verification-link-sent")
    return redirect(request.META.get("HTTP_REFERER") or "/dashboard")
