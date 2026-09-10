"""Vide la base de données et crée un compte par type d'utilisateur avec mots de passe courts."""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.contrib.auth.models import User, Group
from appro.models import ArticleStock


# Mots de passe par type d'utilisateur
USERS_CONFIG = [
    ('resprod', 'ResProd', 'Responsable Production', 'res1@n26'),
    ('commercial', 'Commercial', 'Commercial', 'sang@26'),
    ('finance', 'Finance', 'Finance', 'liverp@26'),
    ('direction', 'Direction', 'Direction', 'board@26'),
    ('admin', None, 'Administrateur', 'tigre@26'),
]


class Command(BaseCommand):
    help = 'Vide la base de données et crée 5 utilisateurs (resprod, commercial, finance, direction, admin) avec mots de passe courts'

    def handle(self, *args, **options):
        self.stdout.write('Vidage de la base de données...')
        call_command('flush', '--no-input')
        self.stdout.write(self.style.SUCCESS('Base vidée.'))

        # Créer les groupes
        for name in ['ResProd', 'Commercial', 'Finance', 'Direction']:
            Group.objects.get_or_create(name=name)
        self.stdout.write(self.style.SUCCESS('Groupes créés.'))

        # Créer les utilisateurs
        for username, group_name, description, password in USERS_CONFIG:
            user = User.objects.create_user(
                username=username,
                email=f'{username}@jusorange.local',
                password=password,
                first_name=description,
                is_staff=(group_name is None),
                is_superuser=(group_name is None),
            )
            if group_name:
                group = Group.objects.get(name=group_name)
                user.groups.add(group)
            self.stdout.write(self.style.SUCCESS(f'  {username} / {password} ({description})'))

        # Créer les articles de base (bouteilles vides, préformes, jus, oranges)
        articles = [
            ('orange_dispo', 0, 100, None, None),
            ('bouteille_vide_33cl', 0, 30, None, None),
            ('bouteille_vide_1l', 0, 20, None, None),
            ('preforme_33cl', 0, 50, None, None),
            ('preforme_1l', 0, 50, None, None),
            ('jus_33cl', 0, 10, 750.0, None),
            ('jus_1l', 0, 10, None, 2500.0),
        ]
        for type_art, qte, seuil, prix_33, prix_1l in articles:
            ArticleStock.objects.get_or_create(
                type_art=type_art,
                defaults={
                    'qte_art': qte,
                    'seuil_alerte': seuil,
                    'prix_33cl': prix_33,
                    'prix_1l': prix_1l,
                }
            )
        self.stdout.write(self.style.SUCCESS('Articles de base crees (bouteilles vides, preformes, jus, etc.).'))

        self.stdout.write(self.style.SUCCESS('\nTermine. Comptes crees :'))
        for username, _, _, password in USERS_CONFIG:
            self.stdout.write(f'  {username} -> mot de passe : {password}')
