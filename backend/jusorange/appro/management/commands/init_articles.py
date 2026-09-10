"""Crée les articles de base s'ils n'existent pas (bouteilles vides, préformes, jus, etc.)."""
from django.core.management.base import BaseCommand
from appro.models import ArticleStock


ARTICLES = [
    ('orange_dispo', 0, 100, None, None),
    ('bouteille_vide_33cl', 0, 30, None, None),
    ('bouteille_vide_1l', 0, 20, None, None),
    ('preforme_33cl', 0, 50, None, None),
    ('preforme_1l', 0, 50, None, None),
    ('jus_33cl', 0, 10, 750.0, None),
    ('jus_1l', 0, 10, None, 2500.0),
]


class Command(BaseCommand):
    help = 'Crée les articles de base (bouteilles vides, préformes, jus) s\'ils n\'existent pas'

    def handle(self, *args, **options):
        for type_art, qte, seuil, prix_33, prix_1l in ARTICLES:
            art, created = ArticleStock.objects.get_or_create(
                type_art=type_art,
                defaults={
                    'qte_art': qte,
                    'seuil_alerte': seuil,
                    'prix_33cl': prix_33,
                    'prix_1l': prix_1l,
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Créé : {art.get_type_art_display()}'))
            else:
                self.stdout.write(f'  Existant : {art.get_type_art_display()}')
        self.stdout.write(self.style.SUCCESS('Terminé.'))
