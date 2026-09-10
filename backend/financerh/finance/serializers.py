from rest_framework import serializers

from core.constants import ROLES_FINANCE
from core.serializers import DocumentValidableSerializer
from finance.models import (
    ApprovisionnementCaisse,
    BaremePerdiem,
    BonCommande,
    Caisse,
    CategorieDepense,
    ConsommationCommunication,
    Depense,
    DemandePrix,
    ForfaitCommunication,
    Fournisseur,
    LigneFraisMission,
    LigneRequisition,
    Mission,
    OffreFournisseur,
    Prestation,
    Requisition,
    SortieCaisse,
)

CHAMPS_CIRCULATION = [
    "demandeur_departement",
    "demandeur_departement_nom",
    "statut",
    "statut_libelle",
    "motif_rejet",
    "date_soumission",
    "etape_courante_libelle",
    "etapes",
    "modifiable",
    "verrou_motif",
    "devise",
    "cree_le",
]
LECTURE_SEULE_CIRCULATION = [
    "numero",
    "demandeur",
    "statut",
    "motif_rejet",
    "date_soumission",
]


class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = [
            "id",
            "code",
            "raison_sociale",
            "categorie",
            "contact",
            "telephone",
            "email",
            "adresse",
            "numero_fiscal",
            "actif",
        ]


class CategorieDepenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategorieDepense
        fields = ["id", "code", "libelle", "imputation", "actif"]


# ---------------------------------------------------------------------------
# Requisitions
# ---------------------------------------------------------------------------


class LigneRequisitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LigneRequisition
        fields = [
            "id",
            "requisition",
            "designation",
            "quantite",
            "unite",
            "prix_unitaire",
            "montant",
        ]
        read_only_fields = ["montant"]


class LigneRequisitionImbriqueeSerializer(LigneRequisitionSerializer):
    """Variante utilisee a l'interieur d'une requisition : le parent est implicite."""

    class Meta(LigneRequisitionSerializer.Meta):
        fields = ["id", "designation", "quantite", "unite", "prix_unitaire", "montant"]


class RequisitionSerializer(DocumentValidableSerializer):
    lignes = LigneRequisitionImbriqueeSerializer(many=True, read_only=True)
    departement_nom = serializers.CharField(
        source="departement.nom", read_only=True, default=""
    )
    priorite_libelle = serializers.CharField(source="get_priorite_display", read_only=True)

    class Meta:
        model = Requisition
        fields = [
            "id",
            "numero",
            "demandeur",
            "demandeur_nom",
            "objet",
            "departement",
            "departement_nom",
            "justification",
            "date_besoin",
            "priorite",
            "priorite_libelle",
            "montant",
            "lignes",
        ] + CHAMPS_CIRCULATION
        read_only_fields = LECTURE_SEULE_CIRCULATION + ["montant"]


class RequisitionAvecLignesSerializer(RequisitionSerializer):
    """Creation d'une requisition et de ses lignes en une seule requete."""

    lignes = LigneRequisitionImbriqueeSerializer(many=True, required=False)

    def create(self, validated_data):
        lignes = validated_data.pop("lignes", [])
        requisition = Requisition.objects.create(**validated_data)
        for ligne in lignes:
            LigneRequisition.objects.create(requisition=requisition, **ligne)
        requisition.recalculer_montant()
        return requisition

    def update(self, instance, validated_data):
        lignes = validated_data.pop("lignes", None)
        requisition = super().update(instance, validated_data)
        if lignes is not None:
            requisition.lignes.all().delete()
            for ligne in lignes:
                LigneRequisition.objects.create(requisition=requisition, **ligne)
            requisition.recalculer_montant()
        return requisition


# ---------------------------------------------------------------------------
# Demandes de prix et achats
# ---------------------------------------------------------------------------


class OffreFournisseurSerializer(serializers.ModelSerializer):
    fournisseur_nom = serializers.CharField(
        source="fournisseur.raison_sociale", read_only=True
    )

    class Meta:
        model = OffreFournisseur
        fields = [
            "id",
            "demande_prix",
            "fournisseur",
            "fournisseur_nom",
            "montant",
            "devise",
            "delai_livraison_jours",
            "conditions_paiement",
            "note_technique",
            "retenue",
            "commentaire",
        ]
        read_only_fields = ["retenue"]


class DemandePrixSerializer(serializers.ModelSerializer):
    offres = OffreFournisseurSerializer(many=True, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    requisition_numero = serializers.CharField(
        source="requisition.numero", read_only=True, default=""
    )
    acheteur_nom = serializers.CharField(
        source="acheteur.get_full_name", read_only=True, default=""
    )
    montant_retenu = serializers.SerializerMethodField()

    class Meta:
        model = DemandePrix
        fields = [
            "id",
            "numero",
            "requisition",
            "requisition_numero",
            "objet",
            "description",
            "date_lancement",
            "date_limite",
            "critere_attribution",
            "statut",
            "statut_libelle",
            "acheteur",
            "acheteur_nom",
            "offres",
            "montant_retenu",
            "cree_le",
        ]
        read_only_fields = ["numero", "statut"]

    def get_montant_retenu(self, obj):
        offre = obj.offre_retenue
        return offre.montant if offre else None


class BonCommandeSerializer(DocumentValidableSerializer):
    fournisseur_nom = serializers.CharField(
        source="fournisseur.raison_sociale", read_only=True
    )
    requisition_numero = serializers.CharField(
        source="requisition.numero", read_only=True, default=""
    )

    class Meta:
        model = BonCommande
        fields = [
            "id",
            "numero",
            "demandeur",
            "demandeur_nom",
            "requisition",
            "requisition_numero",
            "demande_prix",
            "fournisseur",
            "fournisseur_nom",
            "objet",
            "montant",
            "date_livraison_prevue",
            "date_livraison_reelle",
            "conditions",
        ] + CHAMPS_CIRCULATION
        read_only_fields = LECTURE_SEULE_CIRCULATION


# ---------------------------------------------------------------------------
# Caisse et depenses
# ---------------------------------------------------------------------------


#: Champs de la caisse reserves au back-office Finance.
CHAMPS_CAISSE_CONFIDENTIELS = [
    "solde_initial",
    "plafond_alerte",
    "total_approvisionne",
    "total_decaisse",
    "solde_actuel",
    "sous_alerte",
]


class CaisseSerializer(serializers.ModelSerializer):
    solde_actuel = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_decaisse = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_approvisionne = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    sous_alerte = serializers.BooleanField(read_only=True)
    responsable_nom = serializers.CharField(
        source="responsable.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = Caisse
        fields = [
            "id",
            "code",
            "libelle",
            "responsable",
            "responsable_nom",
            "devise",
            "solde_initial",
            "plafond_alerte",
            "total_approvisionne",
            "total_decaisse",
            "solde_actuel",
            "sous_alerte",
            "actif",
        ]

    def to_representation(self, instance):
        """Masque les soldes hors back-office Finance.

        La liste des caisses reste lisible : un agent doit pouvoir choisir la
        caisse de sa demande de decaissement. En revanche, la tresorerie
        elle-meme ne sort pas du perimetre Finance.
        """
        donnees = super().to_representation(instance)
        requete = self.context.get("request")
        if requete and requete.user.is_authenticated:
            if requete.user.role in ROLES_FINANCE:
                return donnees
        for champ in CHAMPS_CAISSE_CONFIDENTIELS:
            donnees.pop(champ, None)
        return donnees


class ApprovisionnementCaisseSerializer(serializers.ModelSerializer):
    caisse_libelle = serializers.CharField(source="caisse.libelle", read_only=True)

    class Meta:
        model = ApprovisionnementCaisse
        fields = [
            "id",
            "caisse",
            "caisse_libelle",
            "montant",
            "date_operation",
            "reference",
            "commentaire",
            "enregistre_par",
        ]
        read_only_fields = ["enregistre_par"]


class SortieCaisseSerializer(DocumentValidableSerializer):
    caisse_libelle = serializers.CharField(source="caisse.libelle", read_only=True)
    categorie_libelle = serializers.CharField(
        source="categorie.libelle", read_only=True, default=""
    )

    class Meta:
        model = SortieCaisse
        fields = [
            "id",
            "numero",
            "demandeur",
            "demandeur_nom",
            "caisse",
            "caisse_libelle",
            "categorie",
            "categorie_libelle",
            "beneficiaire",
            "beneficiaire_agent",
            "motif",
            "montant",
            "date_sortie",
            "piece_justificative",
            "date_decaissement",
            "decaisse_par",
        ] + CHAMPS_CIRCULATION
        read_only_fields = LECTURE_SEULE_CIRCULATION + [
            "date_decaissement",
            "decaisse_par",
        ]

    def validate(self, attrs):
        caisse = attrs.get("caisse", getattr(self.instance, "caisse", None))
        montant = attrs.get("montant", getattr(self.instance, "montant", None))
        if caisse and montant and montant > caisse.solde_actuel:
            raise serializers.ValidationError(
                {
                    "montant": (
                        f"Solde insuffisant sur {caisse.libelle} "
                        f"(disponible : {caisse.solde_actuel})."
                    )
                }
            )
        return attrs


class DepenseSerializer(DocumentValidableSerializer):
    """La demande d'engagement du salarie : objet, montant, date, motif.

    La categorie n'est pas demandee au formulaire — le salarie n'a pas a
    connaitre le plan comptable. Omise, elle retombe sur la categorie par
    defaut, que la Finance reclassera si besoin.
    """

    categorie = serializers.PrimaryKeyRelatedField(
        queryset=CategorieDepense.objects.all(), required=False, allow_null=True
    )
    categorie_libelle = serializers.CharField(source="categorie.libelle", read_only=True)
    fournisseur_nom = serializers.CharField(
        source="fournisseur.raison_sociale", read_only=True, default=""
    )
    mode_paiement_libelle = serializers.CharField(
        source="get_mode_paiement_display", read_only=True
    )

    def validate_categorie(self, valeur):
        from core.referentiels import categorie_depense_defaut

        return valeur or categorie_depense_defaut()

    def validate(self, attrs):
        from core.referentiels import categorie_depense_defaut

        if not self.instance and not attrs.get("categorie"):
            attrs["categorie"] = categorie_depense_defaut()
        return super().validate(attrs)

    class Meta:
        model = Depense
        fields = [
            "id",
            "numero",
            "demandeur",
            "demandeur_nom",
            "categorie",
            "categorie_libelle",
            "departement",
            "fournisseur",
            "fournisseur_nom",
            "libelle",
            "description",
            "montant",
            "date_depense",
            "mode_paiement",
            "mode_paiement_libelle",
            "reference_paiement",
            "piece_justificative",
        ] + CHAMPS_CIRCULATION
        read_only_fields = LECTURE_SEULE_CIRCULATION


# ---------------------------------------------------------------------------
# Missions, perdiems, prestations
# ---------------------------------------------------------------------------


class BaremePerdiemSerializer(serializers.ModelSerializer):
    zone_libelle = serializers.CharField(source="get_zone_display", read_only=True)

    class Meta:
        model = BaremePerdiem
        fields = [
            "id",
            "libelle",
            "zone",
            "zone_libelle",
            "role_agent",
            "montant_jour",
            "devise",
            "actif",
        ]


class LigneFraisMissionSerializer(serializers.ModelSerializer):
    categorie_libelle = serializers.CharField(
        source="categorie.libelle", read_only=True, default=""
    )

    class Meta:
        model = LigneFraisMission
        fields = [
            "id",
            "mission",
            "libelle",
            "categorie",
            "categorie_libelle",
            "montant",
            "date_depense",
            "justificatif",
            "valide",
        ]
        read_only_fields = ["valide"]


class MissionSerializer(DocumentValidableSerializer):
    frais = LigneFraisMissionSerializer(many=True, read_only=True)
    bareme_libelle = serializers.CharField(source="bareme.libelle", read_only=True, default="")
    zone_libelle = serializers.CharField(source="get_zone_display", read_only=True)
    total_frais_justifies = serializers.SerializerMethodField()

    class Meta:
        model = Mission
        fields = [
            "id",
            "numero",
            "demandeur",
            "demandeur_nom",
            "objet",
            "destination",
            "zone",
            "zone_libelle",
            "date_depart",
            "date_retour",
            "moyen_transport",
            "participants",
            "bareme",
            "bareme_libelle",
            "nb_jours",
            "montant_perdiem",
            "frais_transport",
            "frais_hebergement",
            "autres_frais",
            "montant",
            "rapport",
            "date_rapport",
            "frais",
            "total_frais_justifies",
        ] + CHAMPS_CIRCULATION
        read_only_fields = LECTURE_SEULE_CIRCULATION + [
            "nb_jours",
            "montant_perdiem",
            "montant",
        ]

    def get_total_frais_justifies(self, obj):
        return sum((ligne.montant for ligne in obj.frais.all()), start=0)

    def validate(self, attrs):
        depart = attrs.get("date_depart", getattr(self.instance, "date_depart", None))
        retour = attrs.get("date_retour", getattr(self.instance, "date_retour", None))
        if depart and retour and retour < depart:
            raise serializers.ValidationError(
                {"date_retour": "Le retour doit suivre le depart."}
            )
        return attrs


class PrestationSerializer(DocumentValidableSerializer):
    prestataire_nom = serializers.CharField(
        source="prestataire.raison_sociale", read_only=True
    )

    class Meta:
        model = Prestation
        fields = [
            "id",
            "numero",
            "demandeur",
            "demandeur_nom",
            "prestataire",
            "prestataire_nom",
            "objet",
            "description",
            "date_debut",
            "date_fin",
            "montant",
            "livrables",
            "taux_execution",
        ] + CHAMPS_CIRCULATION
        read_only_fields = LECTURE_SEULE_CIRCULATION


# ---------------------------------------------------------------------------
# Forfaits de communication
# ---------------------------------------------------------------------------


class ConsommationCommunicationSerializer(serializers.ModelSerializer):
    depassement = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    agent_nom = serializers.CharField(source="forfait.agent.get_full_name", read_only=True)

    class Meta:
        model = ConsommationCommunication
        fields = [
            "id",
            "forfait",
            "agent_nom",
            "mois",
            "montant_consomme",
            "depassement",
            "commentaire",
        ]


class ForfaitCommunicationSerializer(serializers.ModelSerializer):
    agent_nom = serializers.CharField(source="agent.get_full_name", read_only=True)
    departement_nom = serializers.CharField(
        source="agent.departement.nom", read_only=True, default=""
    )
    type_forfait_libelle = serializers.CharField(
        source="get_type_forfait_display", read_only=True
    )
    consommations = ConsommationCommunicationSerializer(many=True, read_only=True)

    class Meta:
        model = ForfaitCommunication
        fields = [
            "id",
            "agent",
            "agent_nom",
            "departement_nom",
            "operateur",
            "numero_ligne",
            "type_forfait",
            "type_forfait_libelle",
            "montant_mensuel",
            "devise",
            "date_debut",
            "date_fin",
            "actif",
            "consommations",
        ]
