"""Formulaires d'authentification avec messages en français."""
from django.contrib.auth.forms import AuthenticationForm


class AuthenticationFormFR(AuthenticationForm):
    """Formulaire de connexion avec messages d'erreur en français."""

    error_messages = {
        'invalid_login': (
            "Veuillez saisir un nom d'utilisateur et un mot de passe valides. "
        ),
        'inactive': "Ce compte a été désactivé.",
    }
