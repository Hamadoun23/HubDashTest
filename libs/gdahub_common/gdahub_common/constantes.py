"""Vocabulaire commun a tous les documents validables de l'ERP.

Reprises telles quelles de FinanceRH : ces valeurs sont deja inscrites dans
les donnees de production, et les renommer obligerait a migrer ce qui existe
sans rien apporter.
"""

from django.db import models


class NatureEtape(models.TextChoices):
    """Ce que l'on attend du valideur d'une etape.

    `DECISION` engage : un refus arrete le dossier. `AVIS` consigne une
    opinion : un refus est transmis a l'etape suivante, qui tranche.
    `INFORMATION` n'attend rien : l'etape est franchie a la soumission et sert
    uniquement a tracer que le service a ete tenu au courant.
    """

    DECISION = "DECISION", "Decision"
    AVIS = "AVIS", "Avis consultatif"
    INFORMATION = "INFORMATION", "Pour information"


class StatutDocument(models.TextChoices):
    BROUILLON = "BROUILLON", "Brouillon"
    SOUMIS = "SOUMIS", "Soumis"
    EN_VALIDATION = "EN_VALIDATION", "En cours de validation"
    APPROUVE = "APPROUVE", "Approuve"
    REJETE = "REJETE", "Rejete"
    ANNULE = "ANNULE", "Annule"
    CLOTURE = "CLOTURE", "Cloture"


#: Statuts ou le sort du dossier est fixe : plus rien ne s'y modifie.
#:
#: Un dossier en circulation n'y figure pas. Tant qu'aucun valideur ne s'est
#: prononce, le demandeur reste maitre de sa demande : il peut la corriger ou
#: la retirer. C'est le premier geste d'un responsable qui la fige, pas la
#: soumission — voir `validation.raison_verrou`.
STATUTS_TRANCHES = {
    StatutDocument.APPROUVE,
    StatutDocument.REJETE,
    StatutDocument.ANNULE,
    StatutDocument.CLOTURE,
}


class Decision(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    APPROUVE = "APPROUVE", "Approuve"
    REJETE = "REJETE", "Rejete"
    IGNORE = "IGNORE", "Ignore"


class TypeDocument(models.TextChoices):
    """Types de documents soumis a un circuit de validation par seuils.

    La liste couvre tout l'ERP, pas seulement le service qui la consulte : les
    regles sont paramétrees au meme endroit, chez `direction`, et un service
    ne lit que les types qui le concernent.
    """

    TOUS = "TOUS", "Tous les documents"

    # Ressources humaines
    ABSENCE = "ABSENCE", "Demande d'absence / conge"

    # Finance
    REQUISITION = "REQUISITION", "Demande de requisition"
    SORTIE_CAISSE = "SORTIE_CAISSE", "Sortie de caisse"
    DEPENSE = "DEPENSE", "Depense"
    MISSION = "MISSION", "Ordre de mission / perdiem"
    PRESTATION = "PRESTATION", "Prestation"
    BON_COMMANDE = "BON_COMMANDE", "Bon de commande"
    FORFAIT_COM = "FORFAIT_COM", "Forfait de communication"


class Devise(models.TextChoices):
    XOF = "XOF", "Franc CFA (XOF)"
    EUR = "EUR", "Euro"
    USD = "USD", "Dollar US"
