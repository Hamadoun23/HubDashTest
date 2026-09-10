"""Representations JSON des documents validables, communes a tout l'ERP.

Le shell React n'a qu'une seule forme de circuit a comprendre, qu'il affiche
un conge ou un bon de commande.
"""

from rest_framework import serializers

from gdahub_common.validation.models import EtapeValidation, RegleCircuit
from gdahub_common.validation.moteur import raison_verrou


class EtapeValidationSerializer(serializers.ModelSerializer):
    nature_libelle = serializers.CharField(source="get_nature_display", read_only=True)
    decision_libelle = serializers.CharField(
        source="get_decision_display", read_only=True
    )

    class Meta:
        model = EtapeValidation
        fields = [
            "id",
            "ordre",
            "libelle",
            "role_valideur",
            "valideur_identifiant",
            "valideur_nom",
            "nature",
            "nature_libelle",
            "decision",
            "decision_libelle",
            "decide_par_identifiant",
            "decide_par_nom",
            "date_decision",
            "commentaire",
        ]
        read_only_fields = fields


class RegleCircuitSerializer(serializers.ModelSerializer):
    type_document_libelle = serializers.CharField(
        source="get_type_document_display", read_only=True
    )
    nature_libelle = serializers.CharField(source="get_nature_display", read_only=True)

    class Meta:
        model = RegleCircuit
        fields = [
            "id",
            "libelle",
            "type_document",
            "type_document_libelle",
            "montant_min",
            "montant_max",
            "role_valideur",
            "ordre",
            "valideur_hierarchique",
            "valideur_identifiant",
            "valideur_nom",
            "nature",
            "nature_libelle",
            "actif",
        ]

    def validate(self, donnees):
        mini = donnees.get("montant_min", getattr(self.instance, "montant_min", 0))
        maxi = donnees.get("montant_max", getattr(self.instance, "montant_max", None))
        if maxi is not None and mini is not None and maxi < mini:
            raise serializers.ValidationError(
                {"montant_max": "Le plafond ne peut pas etre inferieur au plancher."}
            )
        return donnees


class DecisionSerializer(serializers.Serializer):
    """Corps de requete des actions « valider » et « rejeter »."""

    commentaire = serializers.CharField(required=False, allow_blank=True, default="")


class DocumentValidableSerializer(serializers.ModelSerializer):
    """Base des serializers de documents soumis au circuit de validation.

    Les champs du demandeur sont en lecture seule : ils sont recopies de
    l'annuaire a la creation, jamais saisis. Laisser le client les fournir
    reviendrait a le laisser deposer une demande au nom d'un autre.
    """

    etapes = EtapeValidationSerializer(many=True, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    etape_courante_libelle = serializers.SerializerMethodField()
    #: Le demandeur peut-il encore corriger ou retirer son dossier ? L'API le
    #: dit plutot que de laisser l'interface rejouer la regle de son cote :
    #: elle ne connait ni les etapes pour information ni les statuts a venir.
    modifiable = serializers.SerializerMethodField()
    verrou_motif = serializers.SerializerMethodField()

    CHAMPS_DEMANDEUR = [
        "demandeur_identifiant",
        "demandeur_compte_id",
        "demandeur_agent_id",
        "demandeur_nom",
        "demandeur_departement_id",
        "demandeur_departement_nom",
        "responsable_identifiant",
        "responsable_nom",
    ]

    CHAMPS_CIRCUIT = [
        "numero",
        "statut",
        "statut_libelle",
        "motif_rejet",
        "date_soumission",
        "etape_courante_libelle",
        "etapes",
        "modifiable",
        "verrou_motif",
        "cree_le",
    ]

    def get_etape_courante_libelle(self, document):
        etape = document.etape_courante
        return etape.libelle if etape else ""

    def get_modifiable(self, document):
        return raison_verrou(document) is None

    def get_verrou_motif(self, document):
        return raison_verrou(document) or ""
