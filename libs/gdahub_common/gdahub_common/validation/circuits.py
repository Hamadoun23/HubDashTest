"""Les circuits de validation de GDA, tels qu'ils fonctionnent aujourd'hui.

Ce n'est pas un jeu d'essai : sans regle applicable, un document soumis est
approuve d'office, sans etape ni trace. Ce module est donc la source des
circuits, et chaque service y prend ceux qui le concernent.

Un seul parcours, le meme pour toutes les demandes :

    responsable -> service financier -> RH -> directeur des operations -> DG

Chaque etape designe son valideur par ordre de priorite decroissante : une
personne nommee, puis le responsable du demandeur, puis n'importe quel porteur
du role — qui sert aussi de repli quand le demandeur n'a pas de responsable.

La nature de l'etape dit ce que l'on attend de son valideur :

- `DECISION` engage : un refus arrete le dossier ;
- `AVIS` consigne une opinion : un refus est transmis a l'etape suivante ;
- `INFORMATION` n'attend rien : l'etape est franchie a la soumission, le
  service est seulement tenu au courant.

Le financier ne gere pas les conges : sur une absence, son etape est une
simple information. Sur une demande d'engagement, il rend un avis. C'est la
regle de l'application d'origine, conservee telle quelle.

**Une consequence du decoupage en services.** Les roles n'existent plus que
rattaches a une application : « gestionnaire » ne veut pas dire la meme chose
sur `rh` et sur `finance`. Une etape qui informe un service voisin porte donc
un code de role que personne ne detient dans l'application courante — c'est
sans effet, une etape d'information n'attendant aucun geste, et cela garde la
trace que le service a bien ete cite au circuit.
"""

from decimal import Decimal

from gdahub_common import effectif
from gdahub_common.constantes import NatureEtape, TypeDocument
from gdahub_common.validation.models import RegleCircuit

DECISION = NatureEtape.DECISION
AVIS = NatureEtape.AVIS
INFORMATION = NatureEtape.INFORMATION

#: Postes tenus par une personne precise : le role ne suffit pas a les
#: distinguer, le directeur general et le directeur des operations relevant
#: tous deux de la direction. Qui les occupe se lit dans le fichier
#: d'effectif — l'organigramme est une donnee, pas du code. Poste vacant, et
#: l'etape retombe sur le role.
DIRECTEUR_GENERAL = "directeur_general"
DIRECTEUR_OPERATIONS = "directeur_operations"


def _parcours(type_document, role_financier, nature_financier, role_rh, nature_rh):
    """Les cinq niveaux, du responsable du demandeur au Directeur General."""
    return [
        {
            "libelle": "Avis du responsable",
            "type_document": type_document,
            "role_valideur": "direction",
            "ordre": 1,
            "valideur_hierarchique": True,
            "poste": None,
            "nature": AVIS,
        },
        {
            "libelle": "Service financier",
            "type_document": type_document,
            "role_valideur": role_financier,
            "ordre": 2,
            "valideur_hierarchique": False,
            "poste": None,
            "nature": nature_financier,
        },
        {
            "libelle": "Avis des Ressources Humaines",
            "type_document": type_document,
            "role_valideur": role_rh,
            "ordre": 3,
            "valideur_hierarchique": False,
            "poste": None,
            "nature": nature_rh,
        },
        {
            "libelle": "Avis du Directeur des Operations",
            "type_document": type_document,
            "role_valideur": "direction",
            "ordre": 4,
            "valideur_hierarchique": False,
            "poste": DIRECTEUR_OPERATIONS,
            "nature": AVIS,
        },
        {
            "libelle": "Decision du Directeur General",
            "type_document": type_document,
            "role_valideur": "direction",
            "ordre": 5,
            "valideur_hierarchique": False,
            "poste": DIRECTEUR_GENERAL,
            "nature": DECISION,
        },
    ]


#: Les circuits, par application. Un service ne charge que les siens.
CIRCUITS = {
    # Conges, permissions et retards. Les RH tranchent dans leur domaine, le
    # financier est seulement tenu au courant.
    "rh": _parcours(
        TypeDocument.ABSENCE,
        role_financier="finance",
        nature_financier=INFORMATION,
        role_rh="gestionnaire",
        nature_rh=AVIS,
    ),
    # Demandes d'engagement. Le financier rend un avis, c'est son domaine ;
    # les RH sont tenues au courant.
    "finance": [
        *_parcours(
            TypeDocument.DEPENSE,
            role_financier="gestionnaire",
            nature_financier=AVIS,
            role_rh="rh",
            nature_rh=INFORMATION,
        ),
        *_parcours(
            TypeDocument.REQUISITION,
            role_financier="gestionnaire",
            nature_financier=AVIS,
            role_rh="rh",
            nature_rh=INFORMATION,
        ),
        *_parcours(
            TypeDocument.SORTIE_CAISSE,
            role_financier="gestionnaire",
            nature_financier=AVIS,
            role_rh="rh",
            nature_rh=INFORMATION,
        ),
        *_parcours(
            TypeDocument.MISSION,
            role_financier="gestionnaire",
            nature_financier=AVIS,
            role_rh="gestionnaire",
            nature_rh=AVIS,
        ),
        *_parcours(
            TypeDocument.PRESTATION,
            role_financier="gestionnaire",
            nature_financier=AVIS,
            role_rh="rh",
            nature_rh=INFORMATION,
        ),
        *_parcours(
            TypeDocument.BON_COMMANDE,
            role_financier="gestionnaire",
            nature_financier=AVIS,
            role_rh="rh",
            nature_rh=INFORMATION,
        ),
        *_parcours(
            TypeDocument.FORFAIT_COM,
            role_financier="gestionnaire",
            nature_financier=AVIS,
            role_rh="rh",
            nature_rh=INFORMATION,
        ),
    ],
}


def titulaires_des_postes() -> dict[str, tuple[str, str]]:
    """Qui occupe les postes cles : {poste : (identifiant, nom complet)}.

    Lu dans le fichier d'effectif. Fichier absent ou poste vacant, le
    dictionnaire est simplement incomplet et les etapes concernees retombent
    sur le role — le circuit reste praticable.
    """
    try:
        donnees = effectif.charger()
    except effectif.EffectifIntrouvable:
        return {}

    fiches = effectif.index_par_username(donnees)
    titulaires = {}
    for poste, username in (donnees.get("postes_cles") or {}).items():
        fiche = fiches.get(username)
        if fiche is None:
            continue
        nom = f"{fiche.get('prenom', '')} {fiche.get('nom', '')}".strip()
        titulaires[poste] = (effectif.identifiant_de(fiche), nom)
    return titulaires


def charger(application: str, types_documents=None) -> list[RegleCircuit]:
    """Installe les circuits d'une application.

    Les regles existantes des types traites sont remplacees, pour qu'un
    rechargement donne toujours exactement le circuit decrit ici. Un type
    absent de `CIRCUITS` n'est pas touche : une regle ajoutee a la main depuis
    l'interface survit au rechargement des autres.
    """
    modeles = CIRCUITS.get(application, [])
    if types_documents is not None:
        modeles = [m for m in modeles if m["type_document"] in types_documents]
    if not modeles:
        return []

    concernes = {modele["type_document"] for modele in modeles}
    RegleCircuit.objects.filter(type_document__in=concernes).delete()

    titulaires = titulaires_des_postes()
    creees = []
    for modele in modeles:
        identifiant, nom = titulaires.get(modele["poste"], ("", ""))
        creees.append(
            RegleCircuit(
                libelle=modele["libelle"],
                type_document=modele["type_document"],
                montant_min=Decimal("0"),
                montant_max=None,
                role_valideur=modele["role_valideur"],
                ordre=modele["ordre"],
                valideur_hierarchique=modele["valideur_hierarchique"],
                valideur_identifiant=identifiant,
                valideur_nom=nom,
                nature=modele["nature"],
            )
        )
    return RegleCircuit.objects.bulk_create(creees)
