"""
Modèles campagne — portage de app/Models/Campagne.php et de ses satellites.

La logique de statut, de périmètre (agences / commerciaux) et d'ouverture est
reprise à l'identique : ces règles pilotent l'accès aux écrans de vente et
d'enrôlement, toute divergence se verrait immédiatement en production.
"""

from datetime import date, timedelta

from django.db import models

from core.models import ROLES_COMMERCIAUX, Agence, Partenaire, TypeCarte, User
from core.models_base import LaravelModel, LaravelModelSansTimestamps


class StatutCampagne(models.TextChoices):
    PROGRAMMEE = "programmee", "Programmée"
    EN_COURS = "en_cours", "En cours"
    ARRETEE = "arretee", "Arrêtée"
    ANNULEE = "annulee", "Annulée"
    TERMINEE = "terminee", "Terminée"


class TypeCampagne(models.TextChoices):
    VENTE_CARTE = "vente_carte", "Vente de cartes"
    ENROLEMENT_APP = "enrolement_app", "Enrôlement application"


#: Statuts posés manuellement : ils ne sont jamais recalculés à partir des dates.
STATUTS_MANUELS = [StatutCampagne.ARRETEE, StatutCampagne.ANNULEE]


class Campagne(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    #: Client de GDA pour lequel la campagne est menée. Nul sur les campagnes
    #: antérieures à l'ouverture multi-clients : elles sont toutes BDM.
    partenaire = models.ForeignKey(
        Partenaire,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="partenaire_id",
        related_name="campagnes",
    )
    nom = models.CharField(max_length=255)
    type = models.CharField(
        max_length=30, choices=TypeCampagne.choices, default=TypeCampagne.VENTE_CARTE
    )
    date_debut = models.DateField()
    date_fin = models.DateField()
    prime_meilleur_vendeur = models.DecimalField(
        max_digits=12, decimal_places=0, default=25000
    )
    remise_pourcentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    remise_tous_types_cartes = models.BooleanField(default=True)
    aide_hebdo_active = models.BooleanField(default=False)
    aide_hebdo_montant = models.PositiveIntegerField(default=5000)
    aide_hebdo_carburant = models.PositiveIntegerField(default=3000)
    aide_hebdo_credit_tel = models.PositiveIntegerField(default=2000)
    aide_hebdo_tous_commerciaux = models.BooleanField(default=True)
    contrat_tous_commerciaux = models.BooleanField(default=True)
    contrat_emolument_forfait = models.PositiveIntegerField(default=50000)
    contrat_forfait_communication = models.PositiveIntegerField(default=2000)
    contrat_forfait_deplacement = models.PositiveIntegerField(default=3000)
    contrat_representant_nom = models.CharField(max_length=191, default="Yaya H DIALLO")
    contrat_lieu_signature = models.CharField(max_length=191, default="Bamako")
    contrat_clause_libre = models.TextField(null=True, blank=True)
    contrat_publie_at = models.DateTimeField(null=True, blank=True)
    actif = models.BooleanField(default=True)
    statut = models.CharField(
        max_length=20, choices=StatutCampagne.choices, default=StatutCampagne.PROGRAMMEE
    )
    toutes_agences = models.BooleanField(default=True)

    agences = models.ManyToManyField(
        Agence, through="CampagneAgence", related_name="campagnes"
    )
    beneficiaires_aide = models.ManyToManyField(
        User, through="CampagneAideBeneficiaire", related_name="campagnes_aide"
    )
    signataires_contrat = models.ManyToManyField(
        User, through="CampagneCommercialContrat", related_name="campagnes_signataire"
    )
    types_cartes_remise = models.ManyToManyField(
        TypeCarte, through="CampagneRemiseTypeCarte", related_name="campagnes_remise"
    )

    class Meta:
        managed = False
        db_table = "campagnes"

    def __str__(self):
        return self.nom

    # -- Statut --------------------------------------------------------------

    @property
    def statut_effectif(self) -> str:
        """Statut réel : le statut manuel prime, sinon il est déduit des dates."""
        if self.statut in STATUTS_MANUELS:
            return self.statut
        aujourdhui = date.today()
        if self.date_fin < aujourdhui:
            return StatutCampagne.TERMINEE
        if self.date_debut <= aujourdhui:
            return StatutCampagne.EN_COURS
        return StatutCampagne.PROGRAMMEE

    # -- Périmètre -----------------------------------------------------------

    @property
    def sans_agences(self) -> bool:
        """
        Le partenaire de cette campagne travaille-t-il sans réseau d'agences ?

        UBA n'en a pas : ses commerciaux dépendent directement du partenaire.
        Tout le découpage par agence — périmètre, ouverture, signature du
        contrat — est alors sans objet et court-circuité.
        """
        return bool(self.partenaire_id) and not self.partenaire.a_des_agences

    def concerne_agence(self, agence_id: int) -> bool:
        if self.sans_agences:
            return True
        if self.toutes_agences:
            return True
        return self.agences.filter(pk=agence_id).exists()

    def agences_perimetre(self):
        """
        Agences rattachées, ou toutes celles du partenaire si la campagne est
        « toutes agences ». Vide chez un partenaire qui n'a pas d'agences.

        C'est le point d'entrée de tous les découpages par agence — filtres,
        classements, onglets de rapport, feuilles d'export. Sans le bornage au
        partenaire, une campagne UBA marquée « toutes agences » remonterait ici
        les cinquante-quatre agences de la BDM.

        Renvoie une liste, et non un queryset : dans le cas « toutes agences »
        Laravel trie en SQL (collation insensible à la casse), mais dans le cas
        d'un périmètre restreint il charge la relation puis applique un
        `sortBy('nom')` PHP, qui compare octet par octet — les noms en
        majuscules passent alors avant les autres. Sans cette distinction,
        l'ordre des listes d'agences diverge.
        """
        if self.sans_agences:
            return []
        if self.toutes_agences:
            qs = Agence.objects.all()
            if self.partenaire_id:
                qs = qs.filter(partenaire_id=self.partenaire_id)
            return list(qs.order_by("nom"))
        return sorted(self.agences.all(), key=lambda agence: agence.nom)

    def ids_agences_perimetre(self) -> list[int]:
        return [agence.id for agence in self.agences_perimetre()]

    def query_commerciaux_perimetre(self):
        """
        Commerciaux engagés : les signataires du contrat, sauf si la campagne
        vaut pour « tous les commerciaux » des agences concernées.

        Le périmètre est d'abord borné au partenaire : les commerciaux BDM
        n'ont rien à faire dans une campagne UBA, même quand celle-ci vaut
        pour « tous les commerciaux ».
        """
        if not self.contrat_tous_commerciaux:
            ids = list(self.signataires_contrat.values_list("id", flat=True))
            if not ids:
                return User.objects.none()
            return User.objects.filter(pk__in=ids, role__in=ROLES_COMMERCIAUX)

        qs = User.objects.filter(role__in=ROLES_COMMERCIAUX)
        if self.partenaire_id:
            qs = qs.filter(partenaire_id=self.partenaire_id)
        if self.sans_agences:
            return qs
        if not self.toutes_agences:
            ids_agences = list(self.agences.values_list("id", flat=True))
            if not ids_agences:
                return User.objects.none()
            qs = qs.filter(agence_id__in=ids_agences)
        return qs

    def est_engage_commercial(self, user_id: int) -> bool:
        return self.query_commerciaux_perimetre().filter(pk=user_id).exists()

    def user_est_signataire_contrat(self, user) -> bool:
        if not user.is_commercial_ou_telephonique:
            return False
        if not self.sans_agences and not user.agence_id:
            return False
        return self.signataires_contrat.filter(pk=user.pk).exists()

    def commercial_a_accepte_contrat(self, user_id: int) -> bool:
        return self.contrat_reponses.filter(
            user_id=user_id, statut=StatutReponseContrat.ACCEPTE
        ).exists()

    # -- Ouverture -----------------------------------------------------------

    def est_ouverte(self, agence_id: int) -> bool:
        """Campagne active, non arrêtée ni annulée, dans sa fenêtre, et couvrant l'agence."""
        if not self.actif:
            return False
        if self.statut in STATUTS_MANUELS:
            return False
        if not self.concerne_agence(agence_id):
            return False
        aujourdhui = date.today()
        if self.date_debut > aujourdhui or self.date_fin < aujourdhui:
            return False
        return self.statut_effectif == StatutCampagne.EN_COURS

    def est_active_pour_primes(self, agence_id: int | None = None) -> bool:
        if self.statut_effectif not in (
            StatutCampagne.EN_COURS,
            StatutCampagne.PROGRAMMEE,
        ):
            return False
        aujourdhui = date.today()
        if self.date_debut > aujourdhui or self.date_fin < aujourdhui:
            return False
        if agence_id is not None and not self.toutes_agences:
            return self.agences.filter(pk=agence_id).exists()
        return True

    # -- Contrat et remise ---------------------------------------------------

    def contrat_delai_expire(self) -> bool:
        """Le commercial dispose de 5 jours après publication pour répondre."""
        if not self.contrat_publie_at:
            return False
        from datetime import datetime

        return self.contrat_publie_at + timedelta(days=5) < datetime.now()

    def remise_sapplique_au_type(self, type_carte_id: int) -> bool:
        pourcentage = float(self.remise_pourcentage or 0)
        if pourcentage <= 0:
            return False
        if self.remise_tous_types_cartes:
            return True
        return self.types_cartes_remise.filter(pk=type_carte_id).exists()

    def montant_apres_remise(self, prix_catalogue: int) -> int:
        pourcentage = float(self.remise_pourcentage or 0)
        if pourcentage <= 0:
            return prix_catalogue
        return max(0, round(prix_catalogue * (1 - min(pourcentage, 100) / 100)))

    def types_cartes_pour_reporting_telephonique(self):
        """
        Types proposés au reporting : ceux de la campagne, à défaut le catalogue
        actif de son partenaire.
        """
        catalogue = TypeCarte.objects.filter(actif=True)
        if self.partenaire_id:
            catalogue = catalogue.filter(
                models.Q(partenaire_id=self.partenaire_id)
                | models.Q(partenaire_id__isnull=True)
            )

        if self.remise_tous_types_cartes:
            return catalogue.order_by("code")
        types = self.types_cartes_remise.order_by("code")
        if not types.exists():
            return catalogue.order_by("code")
        return types

    def commercial_recoit_aide_hebdo(self, user) -> bool:
        if (
            not self.aide_hebdo_active
            or not user.is_commercial_ou_telephonique
            or not user.agence_id
            or not user.actif
        ):
            return False
        if not self.concerne_agence(int(user.agence_id)):
            return False
        if self.aide_hebdo_tous_commerciaux:
            return True
        return self.beneficiaires_aide.filter(pk=user.pk).exists()

    # -- Synchronisation des statuts ----------------------------------------

    @staticmethod
    def sync_statuts():
        """
        Recale `statut` et `actif` à partir des dates.

        Plusieurs campagnes peuvent être actives simultanément si leurs périodes
        se chevauchent. Les campagnes arrêtées ou annulées ne sont jamais
        touchées. Reproduit Campagne::syncStatuts().
        """
        aujourdhui = date.today()
        vivantes = Campagne.objects.exclude(statut__in=STATUTS_MANUELS)

        vivantes.filter(date_fin__lt=aujourdhui).update(
            statut=StatutCampagne.TERMINEE, actif=False
        )
        Campagne.objects.update(actif=False)
        vivantes.filter(date_debut__lte=aujourdhui, date_fin__gte=aujourdhui).update(
            statut=StatutCampagne.EN_COURS, actif=True
        )
        vivantes.filter(date_debut__gt=aujourdhui).update(
            statut=StatutCampagne.PROGRAMMEE, actif=False
        )

        Campagne.resynchroniser_actifs_commerciaux()

    @staticmethod
    def resynchroniser_actifs_commerciaux():
        """
        Un commercial est `actif` s'il est engagé sur au moins une campagne
        vivante. Ceux qui ont signé par le passé mais ne sont plus engagés
        sont désactivés.
        """
        aujourdhui = date.today()
        vivantes = Campagne.objects.filter(date_fin__gte=aujourdhui).exclude(
            statut__in=[*STATUTS_MANUELS, StatutCampagne.TERMINEE]
        )

        ids_actifs = set()
        for campagne in vivantes:
            ids_actifs.update(
                campagne.query_commerciaux_perimetre().values_list("id", flat=True)
            )

        ids_historiques = set(
            CampagneCommercialContrat.objects.values_list("user_id", flat=True)
        )
        a_desactiver = ids_historiques - ids_actifs

        if ids_actifs:
            User.objects.filter(role__in=ROLES_COMMERCIAUX, pk__in=ids_actifs).update(
                actif=True
            )
        if a_desactiver:
            User.objects.filter(role__in=ROLES_COMMERCIAUX, pk__in=a_desactiver).update(
                actif=False
            )

    # -- Sélections de référence --------------------------------------------

    @staticmethod
    def _borner(qs, agence_id, partenaire_id):
        """
        Restreint une sélection de campagnes au partenaire, puis à l'agence.

        L'ordre compte : le partenaire cloisonne, l'agence affine à l'intérieur
        de ce cloisonnement. Sans le premier filtre, un commercial UBA — qui
        n'a pas d'agence et ne déclenche donc pas le second — verrait les
        campagnes de la BDM.
        """
        if partenaire_id is not None:
            qs = qs.filter(partenaire_id=partenaire_id)
        if agence_id is not None:
            qs = qs.filter(
                models.Q(toutes_agences=True) | models.Q(agences__id=agence_id)
            ).distinct()
        return qs

    @staticmethod
    def actives_pour_agence(agence_id: int | None = None, partenaire_id: int | None = None):
        """Campagnes ouvertes couvrant l'agence, la plus récente en tête."""
        Campagne.sync_statuts()
        qs = Campagne.objects.filter(actif=True).order_by("-date_debut")
        return Campagne._borner(qs, agence_id, partenaire_id)

    @staticmethod
    def actives_pour_commercial(user):
        """
        Campagnes ouvertes où ce commercial peut travailler.

        Chez un partenaire à réseau d'agences, l'appartenance à une agence est
        la condition d'entrée. Chez un partenaire sans agences, c'est le
        rattachement au partenaire lui-même.
        """
        if user.agence_id:
            return Campagne.actives_pour_agence(
                int(user.agence_id), user.partenaire_id
            )
        if user.partenaire_id:
            return Campagne.actives_pour_agence(None, user.partenaire_id)
        return Campagne.objects.none()

    @staticmethod
    def campagnes_pour_stats(agence_id: int | None = None, partenaire_id: int | None = None):
        """
        Campagnes servant de référence aux statistiques : les campagnes en cours
        du périmètre, à défaut la dernière campagne non annulée.
        """
        actives = list(Campagne.actives_pour_agence(agence_id, partenaire_id))
        if actives:
            return actives

        qs = Campagne.objects.exclude(statut=StatutCampagne.ANNULEE)
        derniere = Campagne._borner(qs, agence_id, partenaire_id).order_by(
            "-date_debut", "-id"
        ).first()
        return [derniere] if derniere else []

    @staticmethod
    def ids_campagnes_pour_stats(
        agence_id: int | None = None, partenaire_id: int | None = None
    ) -> list[int]:
        return [c.id for c in Campagne.campagnes_pour_stats(agence_id, partenaire_id)]

    @staticmethod
    def campagne_pour_performances(
        agence_id: int | None = None, partenaire_id: int | None = None
    ):
        campagnes = Campagne.campagnes_pour_stats(agence_id, partenaire_id)
        return campagnes[0] if campagnes else None

    @staticmethod
    def libelle_campagnes_pour_stats(
        agence_id: int | None = None, partenaire_id: int | None = None
    ) -> str:
        campagnes = Campagne.campagnes_pour_stats(agence_id, partenaire_id)
        if not campagnes:
            return "Aucune campagne"
        noms = [f"« {c.nom} »" for c in campagnes]
        if len(noms) == 1:
            return noms[0]
        return ", ".join(noms[:-1]) + " et " + noms[-1]

    @staticmethod
    def pour_fiche_telephonique(agence_id: int | None, jour, partenaire_id: int | None = None):
        """Campagne couvrant une date pour une agence, la plus récente d'abord."""
        qs = Campagne.objects.filter(
            date_debut__lte=jour, date_fin__gte=jour
        ).exclude(statut=StatutCampagne.ANNULEE)
        return Campagne._borner(qs, agence_id, partenaire_id).order_by(
            "-date_debut"
        ).first()


class CampagneAgence(LaravelModelSansTimestamps):
    id = models.BigAutoField(primary_key=True)
    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, db_column="campagne_id"
    )
    agence = models.ForeignKey(Agence, on_delete=models.CASCADE, db_column="agence_id")

    class Meta:
        managed = False
        db_table = "campagne_agence"
        unique_together = [("campagne", "agence")]


class CampagneAideBeneficiaire(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, db_column="campagne_id"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")

    class Meta:
        managed = False
        db_table = "campagne_aide_beneficiaire"
        unique_together = [("campagne", "user")]


class CampagneCommercialContrat(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, db_column="campagne_id"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")

    class Meta:
        managed = False
        db_table = "campagne_commercial_contrat"
        unique_together = [("campagne", "user")]


class CampagneRemiseTypeCarte(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, db_column="campagne_id"
    )
    type_carte = models.ForeignKey(
        TypeCarte, on_delete=models.CASCADE, db_column="type_carte_id"
    )

    class Meta:
        managed = False
        db_table = "campagne_remise_type_carte"
        unique_together = [("campagne", "type_carte")]


class CampagneAction(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, db_column="campagne_id",
        related_name="actions",
    )
    action = models.CharField(max_length=255)
    description = models.TextField()
    donnees_avant = models.JSONField(null=True, blank=True)
    donnees_apres = models.JSONField(null=True, blank=True)
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, db_column="user_id"
    )

    class Meta:
        managed = False
        db_table = "campagne_actions"


class CampagneAideVersement(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, db_column="campagne_id",
        related_name="aide_versements",
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, db_column="user_id",
        related_name="aide_versements",
    )
    semaine_debut = models.DateField()
    montant_carburant = models.PositiveIntegerField(default=0)
    montant_credit_tel = models.PositiveIntegerField(default=0)
    enregistre_par = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="enregistre_par",
        related_name="versements_enregistres",
    )
    accuse_at = models.DateTimeField(null=True, blank=True)
    accuse_commentaire = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "campagne_aide_versements"

    @property
    def montant_total(self) -> int:
        return int(self.montant_carburant) + int(self.montant_credit_tel)


class CampagneContratArticle(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, db_column="campagne_id",
        related_name="contrat_articles",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    titre = models.CharField(max_length=255)
    contenu = models.TextField()

    class Meta:
        managed = False
        db_table = "campagne_contrat_articles"


class StatutReponseContrat(models.TextChoices):
    EN_ATTENTE = "en_attente", "En attente"
    ACCEPTE = "accepte", "Accepté"
    REJETE = "rejete", "Rejeté"


class ContratPrestationReponse(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, db_column="campagne_id",
        related_name="contrat_reponses",
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, db_column="user_id",
        related_name="contrat_reponses",
    )
    statut = models.CharField(
        max_length=32,
        choices=StatutReponseContrat.choices,
        default=StatutReponseContrat.EN_ATTENTE,
    )
    repondu_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "contrat_prestation_reponses"
        unique_together = [("campagne", "user")]


class CommercialAgenceTransfert(LaravelModel):
    id = models.BigAutoField(primary_key=True)
    commercial_user = models.ForeignKey(
        User, on_delete=models.CASCADE, db_column="commercial_user_id",
        related_name="transferts_subis",
    )
    admin_user = models.ForeignKey(
        User, on_delete=models.CASCADE, db_column="admin_user_id",
        related_name="transferts_effectues",
    )
    nouvelle_agence = models.ForeignKey(
        Agence, on_delete=models.CASCADE, db_column="nouvelle_agence_id",
        related_name="transferts_entrants",
    )
    snapshots = models.JSONField()
    profil_agence_avant = models.ForeignKey(
        Agence, on_delete=models.SET_NULL, null=True, blank=True,
        db_column="profil_agence_avant", related_name="+",
    )
    profil_agence_apres = models.ForeignKey(
        Agence, on_delete=models.SET_NULL, null=True, blank=True,
        db_column="profil_agence_apres", related_name="+",
    )
    note = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "commercial_agence_transferts"
