# Authentification JusOrange GDA

## Fonctionnalités

- **Connexion** : `/login/`
- **Déconnexion** : `/logout/`
- **Mot de passe oublié** : `/password-reset/`
- **Créer un utilisateur** : `/direction/creer-utilisateur/` (réservé à la Direction)
- **Contrôle d'accès par rôle** : ResProd, Commercial, Finance, Direction

## Création d'utilisateurs (Direction)

La Direction peut créer des utilisateurs depuis le dashboard Direction :
- Nom d'utilisateur / Email (ex: hcisse@gdamali.net)
- Mot de passe + confirmation
- Attribution d'un rôle (ResProd, Commercial, Finance, Direction)

## Groupes et rôles

| Groupe | Accès |
|-------|-------|
| ResProd | Récolte, Appro, Fabrication, Emballage, Entrepôt |
| Commercial | Distribution (clients, ventes, commandes, factures, paiements) |
| Finance | Trésorerie (réceptions, écarts) |
| Direction | Reporting, Dashboard, tous les rapports (lecture seule) |
| Superuser/Staff | Tous les accès + Admin Django |

## Créer les groupes

```bash
python manage.py create_groups
```

## Attribuer un rôle à un utilisateur

1. Aller dans l'admin Django : `/admin/`
2. Utilisateurs → sélectionner l'utilisateur
3. Dans "Groupes", ajouter le groupe souhaité (ResProd, Commercial, etc.)

## Réinitialisation du mot de passe

- En développement : les emails sont affichés dans la console (EMAIL_BACKEND = console)
- En production : configurer SMTP dans `settings.py`

## Utilisateurs sans rôle

Les utilisateurs sans groupe attribué voient un message les invitant à contacter l'administrateur.
