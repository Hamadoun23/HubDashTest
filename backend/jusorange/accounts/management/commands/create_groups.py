"""Commande pour créer les groupes de rôles JusOrange."""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group


class Command(BaseCommand):
    help = 'Crée les groupes de rôles JusOrange (ResProd, Commercial, Finance, Direction)'

    def handle(self, *args, **options):
        groups = ['ResProd', 'Commercial', 'Finance', 'Direction']
        for name in groups:
            group, created = Group.objects.get_or_create(name=name)
            if created:
                self.stdout.write(self.style.SUCCESS(f'Groupe créé : {name}'))
            else:
                self.stdout.write(f'Groupe existant : {name}')
        self.stdout.write(self.style.SUCCESS('Terminé.'))
