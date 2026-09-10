"""Referentiels minimaux dont l'application a besoin pour fonctionner.

Trois entrees seulement, la ou l'application en comptait des dizaines : les
types d'absence « Retard » et « Permission », vises chacun par son ecran, et
une categorie de depense par defaut, pour que le formulaire de demande
d'engagement tienne en quatre champs. Le reste du referentiel se cree a
l'usage : un salarie saisit son type de conge en clair, le type est
materialise a la volee.

Retard et permission font exception parce que leur ecran ne demande pas de
type : il l'impose. Un libelle saisi en clair y produirait un type de
categorie « Conge », et le signalement se retrouverait a decompter des jours.
"""

from django.db import transaction

from finance.models import CategorieDepense
from rh.models import CategorieAbsence, TypeAbsence

#: Type vise par l'ecran « Signaler un retard ».
CODE_RETARD = "RETARD"

#: Type vise par l'ecran « Mes permissions ».
CODE_PERMISSION = "PERMISSION"

#: Categorie appliquee d'office aux demandes d'engagement.
CODE_DEPENSE_DEFAUT = "GEN"


@transaction.atomic
def charger_referentiels():
    """Cree les trois entrees indispensables, sans ecraser un reglage existant."""
    retard, _ = TypeAbsence.objects.update_or_create(
        code=CODE_RETARD,
        defaults={
            "libelle": "Retard",
            "categorie": CategorieAbsence.RETARD,
            # Un retard ne se decompte pas d'un solde de conges, et il ne
            # marque pas la journee comme absente : c'est un signalement.
            "decompte_solde": False,
            "duree_max_jours": 1,
            "justificatif_requis": False,
            "actif": True,
        },
    )
    permission, _ = TypeAbsence.objects.update_or_create(
        code=CODE_PERMISSION,
        defaults={
            "libelle": "Permission",
            "categorie": CategorieAbsence.PERMISSION,
            # Une permission est une absence autorisee de courte duree : elle
            # se demande, elle se valide, mais elle ne se prend pas sur les
            # conges annuels. C'est precisement ce qui la distingue d'un conge
            # et ce qui justifie qu'elle ait son propre ecran.
            "decompte_solde": False,
            "duree_max_jours": 3,
            "justificatif_requis": False,
            "actif": True,
        },
    )
    categorie, _ = CategorieDepense.objects.get_or_create(
        code=CODE_DEPENSE_DEFAUT,
        defaults={"libelle": "Demande generale", "imputation": ""},
    )
    return retard, permission, categorie


def type_retard():
    """Le type « Retard », cree au besoin."""
    return charger_referentiels()[0]


def type_permission():
    """Le type « Permission », cree au besoin."""
    return charger_referentiels()[1]


def categorie_depense_defaut():
    """La categorie appliquee quand le demandeur n'en choisit aucune."""
    return charger_referentiels()[2]
