"""
Validation légère reproduisant les règles et les messages de Laravel.

Les vues Laravel appellent `$request->validate([...])` avec une syntaxe
compacte (`'nom' => 'required|string|max:255'`). On garde la même écriture pour
que le portage reste lisible en regard du code d'origine, et les messages sont
ceux de lang/fr/validation.php pour que les props `errors` soient identiques.
"""

import re

from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

MESSAGES = {
    "required": "Le champ :attribute est obligatoire.",
    "email": "Le champ :attribute doit être une adresse e-mail valide.",
    "integer": "Le champ :attribute doit être un entier.",
    "boolean": "Le champ :attribute doit être vrai ou faux.",
    "confirmed": "Le champ de confirmation :attribute ne correspond pas.",
    "unique": "La valeur du champ :attribute est déjà utilisée.",
    "exists": "Le champ :attribute sélectionné est invalide.",
    "in": "Le champ :attribute est invalide.",
    "max_string": "Le texte de :attribute ne peut pas contenir plus de :max caractères.",
    "max_numeric": "La valeur de :attribute ne peut pas être supérieure à :max.",
    "min_string": "Le texte de :attribute doit contenir au moins :min caractères.",
    "min_numeric": "La valeur de :attribute doit être supérieure ou égale à :min.",
    "date": "Le champ :attribute n'est pas une date valide.",
}


class ErreursValidation(Exception):
    """Erreurs de validation, indexées par nom de champ comme dans Laravel."""

    def __init__(self, erreurs):
        self.erreurs = erreurs
        super().__init__(str(erreurs))


def _message(cle, champ, **params):
    texte = MESSAGES[cle].replace(":attribute", champ.replace("_", " "))
    for nom, valeur in params.items():
        texte = texte.replace(f":{nom}", str(valeur))
    return texte


def _vide(valeur):
    return valeur is None or (isinstance(valeur, str) and valeur.strip() == "")


class Validateur:
    """
    Usage :
        donnees = valider(request, {
            'nom': 'required|string|max:255',
            'ordre': 'required|integer|min:0',
        })
    """

    def __init__(self, source):
        self.source = source
        self.erreurs = {}
        self.valeurs = {}

    def champ(self, nom, regles):
        brut = self.source.get(nom)
        regles = regles.split("|") if isinstance(regles, str) else list(regles)
        nullable = "nullable" in regles

        if _vide(brut):
            if "required" in regles:
                self.erreurs.setdefault(nom, _message("required", nom))
                return
            # `nullable` et absence de `required` produisent tous deux None.
            self.valeurs[nom] = None
            if "boolean" in regles:
                self.valeurs[nom] = False
            return

        valeur = brut.strip() if isinstance(brut, str) else brut

        for regle in regles:
            nom_regle, _, parametre = regle.partition(":")

            if nom_regle == "integer":
                try:
                    valeur = int(valeur)
                except (TypeError, ValueError):
                    self.erreurs.setdefault(nom, _message("integer", nom))
                    return

            elif nom_regle == "boolean":
                valeur = str(valeur).lower() in ("1", "true", "on", "yes")

            elif nom_regle == "email":
                try:
                    validate_email(valeur)
                except DjangoValidationError:
                    self.erreurs.setdefault(nom, _message("email", nom))
                    return

            elif nom_regle == "max":
                if isinstance(valeur, (int, float)):
                    if valeur > float(parametre):
                        self.erreurs.setdefault(
                            nom, _message("max_numeric", nom, max=parametre)
                        )
                        return
                elif len(str(valeur)) > int(parametre):
                    self.erreurs.setdefault(
                        nom, _message("max_string", nom, max=parametre)
                    )
                    return

            elif nom_regle == "min":
                if isinstance(valeur, (int, float)):
                    if valeur < float(parametre):
                        self.erreurs.setdefault(
                            nom, _message("min_numeric", nom, min=parametre)
                        )
                        return
                elif len(str(valeur)) < int(parametre):
                    self.erreurs.setdefault(
                        nom, _message("min_string", nom, min=parametre)
                    )
                    return

            elif nom_regle == "in":
                if str(valeur) not in parametre.split(","):
                    self.erreurs.setdefault(nom, _message("in", nom))
                    return

            elif nom_regle == "date":
                if not re.match(r"^\d{4}-\d{2}-\d{2}", str(valeur)):
                    self.erreurs.setdefault(nom, _message("date", nom))
                    return

        self.valeurs[nom] = valeur

    def unique(self, nom, queryset, ignorer_pk=None):
        """Équivalent de Rule::unique(...)->ignore(...)."""
        valeur = self.valeurs.get(nom)
        if _vide(valeur):
            return
        qs = queryset.filter(**{nom: valeur})
        if ignorer_pk is not None:
            qs = qs.exclude(pk=ignorer_pk)
        if qs.exists():
            self.erreurs.setdefault(nom, _message("unique", nom))

    def existe(self, nom, queryset):
        """Équivalent de la règle `exists:table,id`."""
        valeur = self.valeurs.get(nom)
        if _vide(valeur):
            return
        if not queryset.filter(pk=valeur).exists():
            self.erreurs.setdefault(nom, _message("exists", nom))

    def confirme(self, nom):
        """Équivalent de la règle `confirmed` (champ `<nom>_confirmation`)."""
        if self.valeurs.get(nom) != self.source.get(f"{nom}_confirmation"):
            self.erreurs.setdefault(nom, _message("confirmed", nom))

    def erreur(self, nom, message):
        self.erreurs.setdefault(nom, message)

    def resultat(self):
        if self.erreurs:
            raise ErreursValidation(self.erreurs)
        return self.valeurs


def valider(source, regles):
    """Raccourci : valide toutes les règles et renvoie les valeurs nettoyées."""
    validateur = Validateur(source)
    for nom, regle in regles.items():
        validateur.champ(nom, regle)
    return validateur.resultat()


def booleen(source, nom, defaut=False):
    """Équivalent de `$request->boolean('x')`."""
    valeur = source.get(nom)
    if valeur is None:
        return defaut
    return str(valeur).lower() in ("1", "true", "on", "yes")
