"""Vues d'authentification.

Seul le parcours de connexion et de réinitialisation de mot de passe subsiste
côté Django : l'interface métier est entièrement servie par le frontend
Next.js, qui s'authentifie via l'API REST.
"""
from django.contrib.auth.views import (
    LoginView as BaseLoginView,
    LogoutView as BaseLogoutView,
    PasswordResetView,
    PasswordResetDoneView,
    PasswordResetConfirmView,
    PasswordResetCompleteView,
)
from .forms import AuthenticationFormFR
from django.contrib import messages
from django.contrib.messages.views import SuccessMessageMixin


class LoginView(SuccessMessageMixin, BaseLoginView):
    """Vue de connexion."""
    template_name = 'auth/login.html'
    authentication_form = AuthenticationFormFR
    success_message = "Connexion réussie. Bienvenue !"


class LogoutView(BaseLogoutView):
    """Vue de déconnexion."""
    next_page = 'login'

    def dispatch(self, request, *args, **kwargs):
        messages.success(request, "Vous avez été déconnecté.")
        return super().dispatch(request, *args, **kwargs)


class CustomPasswordResetView(SuccessMessageMixin, PasswordResetView):
    template_name = 'auth/password_reset_form.html'
    email_template_name = 'auth/password_reset_email.html'
    subject_template_name = 'auth/password_reset_subject.txt'
    success_url = '/password-reset/done/'
    success_message = "Si un compte existe avec cette email, vous recevrez un lien par email."


class CustomPasswordResetDoneView(PasswordResetDoneView):
    template_name = 'auth/password_reset_done.html'


class CustomPasswordResetConfirmView(SuccessMessageMixin, PasswordResetConfirmView):
    template_name = 'auth/password_reset_confirm.html'
    success_url = '/password-reset/complete/'
    success_message = "Votre mot de passe a été réinitialisé avec succès."


class CustomPasswordResetCompleteView(PasswordResetCompleteView):
    template_name = 'auth/password_reset_complete.html'
