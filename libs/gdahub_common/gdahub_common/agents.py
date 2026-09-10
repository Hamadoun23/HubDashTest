"""Comment un service metier designe un agent sans le posseder.

L'annuaire appartient a `organisation`. Partout ailleurs, un agent se
represente par son identifiant de connexion — la seule cle qui traverse tout
l'ERP — accompagne des quelques champs que l'ecran affiche, figes au moment de
l'enregistrement.

Ce fige n'est pas un effet de bord a corriger : un conge accorde en mars doit
continuer d'indiquer le departement qu'occupait l'agent en mars, pas celui
qu'il occupe aujourd'hui. Les services qui ont besoin de la valeur courante la
demandent a l'annuaire ; les autres, c'est-a-dire presque tous, lisent
l'instantane.
"""

from django.db import models


class ReferenceAgent(models.Model):
    """Un agent cite par un service qui ne possede pas l'annuaire."""

    agent_identifiant = models.CharField(
        "Agent", max_length=150, db_index=True,
        help_text="Identifiant de connexion, cle commune a tout l'ERP.",
    )
    agent_id_annuaire = models.PositiveBigIntegerField(
        "Numero d'agent", null=True, blank=True
    )
    agent_nom = models.CharField("Nom de l'agent", max_length=150, blank=True)
    agent_departement_id = models.PositiveBigIntegerField(
        "Departement", null=True, blank=True, db_index=True
    )
    agent_departement_nom = models.CharField(
        "Nom du departement", max_length=120, blank=True
    )

    class Meta:
        abstract = True

    def appliquer_agent(self, instantane: dict) -> None:
        """Recopie l'instantane renvoye par l'annuaire."""
        self.agent_identifiant = instantane.get("identifiant", "")
        self.agent_id_annuaire = instantane.get("agent_id")
        self.agent_nom = instantane.get("nom_complet", "")
        self.agent_departement_id = instantane.get("departement_id")
        self.agent_departement_nom = instantane.get("departement_nom", "")
