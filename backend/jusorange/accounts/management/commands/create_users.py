"""Commande pour créer les utilisateurs de démo JusOrange (5 types)."""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group


# Mot de passe par défaut pour tous les utilisateurs (à modifier en production)
DEFAULT_PASSWORD = 'JusOrange2025!'


class Command(BaseCommand):
    help = 'Crée 5 utilisateurs de démo : resprod, commercial, finance, direction, admin'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default=DEFAULT_PASSWORD,
            help=f'Mot de passe pour tous les utilisateurs (défaut: {DEFAULT_PASSWORD})',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Réinitialise le mot de passe des utilisateurs existants',
        )

    def handle(self, *args, **options):
        password = options['password']
        force = options['force']

        # S'assurer que les groupes existent
        for name in ['ResProd', 'Commercial', 'Finance', 'Direction']:
            Group.objects.get_or_create(name=name)

        users_config = [
            ('resprod', 'ResProd', 'Responsable Production'),
            ('commercial', 'Commercial', 'Commercial'),
            ('finance', 'Finance', 'Finance'),
            ('direction', 'Direction', 'Direction'),
            ('admin', None, 'Administrateur (accès complet)'),
        ]

        for username, group_name, description in users_config:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@jusorange.local',
                    'first_name': description,
                    'is_staff': group_name is None,
                    'is_superuser': group_name is None,
                }
            )
            if created:
                user.set_password(password)
                user.save()
                if group_name:
                    group, _ = Group.objects.get_or_create(name=group_name)
                    user.groups.add(group)
                self.stdout.write(self.style.SUCCESS(f'Utilisateur créé : {username} ({description})'))
            else:
                if force:
                    user.set_password(password)
                    user.save()
                    self.stdout.write(self.style.WARNING(f'Mot de passe mis à jour : {username}'))
                else:
                    self.stdout.write(f'Utilisateur existant : {username}')

        self.stdout.write(self.style.SUCCESS(
            f'\nConnexion : username / mot de passe = {password}\n'
            'Utilisateurs : resprod, commercial, finance, direction, admin'
        ))
