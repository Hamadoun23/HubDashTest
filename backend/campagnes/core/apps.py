from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        from django.contrib.auth.models import update_last_login
        from django.contrib.auth.signals import user_logged_in

        # La table `users` de Laravel n'a pas de colonne `last_login` : le
        # récepteur par défaut de Django planterait à chaque connexion. Le suivi
        # des connexions passe par `user_login_logs` (cf. core.views.login_store).
        user_logged_in.disconnect(update_last_login)
