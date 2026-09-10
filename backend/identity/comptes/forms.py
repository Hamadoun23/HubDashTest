"""Formulaires de l'administration Django.

Les formulaires livres par django.contrib.auth pointent vers le modele User
par defaut ; comme identity a son propre modele, il faut les redeclarer, sans
quoi la page de creation d'un compte tombe en erreur.
"""

from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from comptes.models import Utilisateur


class FormulaireCreationUtilisateur(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = Utilisateur
        fields = ("identifiant", "nom", "prenom", "email")


class FormulaireModificationUtilisateur(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = Utilisateur
        fields = "__all__"
