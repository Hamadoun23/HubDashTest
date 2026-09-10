"""Signaux pour archiver les données avant suppression."""
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from recolte.models import Cueillette
from .models import Reception


@receiver(pre_delete, sender=Cueillette)
def archiver_cueillette_dans_receptions(sender, instance, **kwargs):
    """
    Avant suppression d'une cueillette :
    Archivage des infos dans cueillette_archive pour chaque réception liée.
    Puis SET_NULL mettra cueillette à None.
    """
    nom_prod = instance.get_producteur_display()
    info = f"{nom_prod} - {instance.date_cueil} - {instance.qte_bon} kg"
    Reception.objects.filter(cueillette=instance).update(cueillette_archive=info)
