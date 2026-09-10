"""Signaux pour archiver les données avant suppression."""
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import Producteur, Cueillette


@receiver(pre_delete, sender=Producteur)
def archiver_producteur_dans_cueillettes(sender, instance, **kwargs):
    """
    Avant suppression d'un producteur :
    Archivage du nom dans producteur_nom_archive pour chaque cueillette liée.
    Puis SET_NULL mettra producteur à None.
    """
    Cueillette.objects.filter(producteur=instance).update(
        producteur_nom_archive=instance.nom_complet
    )
