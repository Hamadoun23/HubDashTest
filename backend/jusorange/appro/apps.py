from django.apps import AppConfig


class ApproConfig(AppConfig):
    # Fige le type de clé primaire sur celui réellement en base (voir
    # DEFAULT_AUTO_FIELD dans settings.py).
    default_auto_field = 'django.db.models.AutoField'
    name = 'appro'
    verbose_name = 'Approvisionnement'

    def ready(self):
        import appro.signals  # noqa: F401
