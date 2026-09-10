"""Circuits de validation.

C'est la configuration du moteur, pas un jeu d'essai : sans regle applicable,
un document soumis est approuve d'office, sans etape ni trace. Ce module est
donc la source unique des circuits, partagee par la commande
``seed_configuration`` et par le jeu de demonstration.

Un seul parcours, le meme pour toutes les demandes :

    responsable -> financier -> RH -> directeur des operations -> DG

Chaque etape designe son valideur par ordre de priorite decroissante :
``valideur`` (une personne nommee), puis ``hierarchique`` (le responsable
direct du demandeur), puis ``role`` (n'importe quel porteur du role, qui sert
aussi de repli quand le demandeur n'a pas de responsable).

La nature de l'etape dit ce que l'on attend de son valideur :

- ``DECISION`` engage : un refus arrete le dossier ;
- ``AVIS`` consigne une opinion : un refus est transmis a l'etape suivante ;
- ``INFORMATION`` n'attend rien : l'etape est franchie a la soumission, le
  service est seulement tenu au courant.

Le financier ne gere pas les conges : sur une absence, son etape est une
simple information. Sur une demande d'engagement, il rend un avis.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.personnel import poste_cle
from core.constants import NatureEtape, Role, TypeDocument
from core.models import SeuilValidation

#: Postes tenus par une personne precise : le role ne suffit pas a les
#: distinguer, le directeur general et le directeur des operations portant
#: tous deux le profil Direction. Les identifiants viennent du fichier
#: d'effectif — l'organigramme est une donnee, pas du code. Poste vacant ou
#: agent absent de la base, l'etape retombe sur le role.
DIRECTEUR_GENERAL = "directeur_general"
DIRECTEUR_OPERATIONS = "directeur_operations"

DECISION = NatureEtape.DECISION
AVIS = NatureEtape.AVIS
INFORMATION = NatureEtape.INFORMATION


def _parcours(type_document, nature_financier):
    """Les cinq niveaux, du responsable du demandeur au Directeur General."""
    return [
        # (libelle, type, mini, maxi, role, ordre, hierarchique, valideur, nature)
        ("Avis du responsable", type_document, 0, None, Role.DIRECTION, 1, True, None, AVIS),
        ("Service financier", type_document, 0, None, Role.FINANCE, 2, False, None, nature_financier),
        ("Avis des Ressources Humaines", type_document, 0, None, Role.RH, 3, False, None, AVIS),
        ("Avis du Directeur des Operations", type_document, 0, None, Role.DIRECTION, 4, False, DIRECTEUR_OPERATIONS, AVIS),
        ("Decision du Directeur General", type_document, 0, None, Role.DIRECTION, 5, False, DIRECTEUR_GENERAL, DECISION),
    ]


CIRCUITS = [
    # Conges, permissions et retards : le financier est tenu au courant, il
    # n'a pas a se prononcer.
    *_parcours(TypeDocument.ABSENCE, INFORMATION),
    # Demandes d'engagement : le financier rend un avis, c'est son domaine.
    *_parcours(TypeDocument.DEPENSE, AVIS),
]


@transaction.atomic
def charger_circuits(types_documents=None):
    """Installe les circuits, en ne touchant qu'aux types demandes.

    ``types_documents`` limite le chargement a certains types (par exemple
    ``[TypeDocument.ABSENCE]``) ; par defaut, tous sont installes. Les regles
    existantes du perimetre traite sont remplacees, pour qu'un rechargement
    donne toujours exactement le circuit decrit ici.
    """
    utilisateurs = get_user_model().objects
    regles = [
        regle
        for regle in CIRCUITS
        if types_documents is None or regle[1] in types_documents
    ]
    concernes = {regle[1] for regle in regles}
    SeuilValidation.objects.filter(type_document__in=concernes).delete()

    crees = []
    for libelle, type_doc, mini, maxi, role, ordre, hierarchique, poste, nature in regles:
        # Le circuit nomme un poste ; le fichier d'effectif dit qui l'occupe.
        username = poste_cle(poste) if poste else None
        valideur = utilisateurs.filter(username=username).first() if username else None
        crees.append(
            SeuilValidation.objects.create(
                libelle=libelle,
                type_document=type_doc,
                montant_min=Decimal(mini),
                montant_max=Decimal(maxi) if maxi else None,
                role_valideur=role,
                ordre=ordre,
                valideur_hierarchique=hierarchique,
                valideur_designe=valideur,
                nature=nature,
            )
        )
    return crees
