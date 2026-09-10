from django.apps import AppConfig


class RecolteConfig(AppConfig):
    # Fige le type de clé primaire sur celui réellement en base (voir
    # DEFAULT_AUTO_FIELD dans settings.py) : sans cela, `makemigrations`
    # proposerait de basculer ces tables en bigint sans aucune raison métier.
    default_auto_field = 'django.db.models.AutoField'
    name = 'recolte'
    verbose_name = 'Récolte'

    def ready(self):
        import recolte.signals  # noqa: F401
