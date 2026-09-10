from rest_framework import serializers

from core.models import EtapeValidation, SeuilValidation
from core.workflow import raison_verrou


class EtapeValidationSerializer(serializers.ModelSerializer):
    role_valideur_libelle = serializers.CharField(
        source="get_role_valideur_display", read_only=True
    )
    decision_libelle = serializers.CharField(source="get_decision_display", read_only=True)
    decide_par_nom = serializers.CharField(
        source="decide_par.get_full_name", read_only=True, default=""
    )
    valideur_attendu_nom = serializers.CharField(
        source="valideur_attendu.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = EtapeValidation
        fields = [
            "id",
            "ordre",
            "libelle",
            "role_valideur",
            "role_valideur_libelle",
            "valideur_attendu",
            "valideur_attendu_nom",
            "nature",
            "decision",
            "decision_libelle",
            "decide_par",
            "decide_par_nom",
            "date_decision",
            "commentaire",
        ]
        read_only_fields = fields


class SeuilValidationSerializer(serializers.ModelSerializer):
    role_valideur_libelle = serializers.CharField(
        source="get_role_valideur_display", read_only=True
    )
    type_document_libelle = serializers.CharField(
        source="get_type_document_display", read_only=True
    )
    valideur_designe_nom = serializers.CharField(
        source="valideur_designe.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = SeuilValidation
        fields = [
            "id",
            "libelle",
            "type_document",
            "type_document_libelle",
            "montant_min",
            "montant_max",
            "role_valideur",
            "role_valideur_libelle",
            "ordre",
            "valideur_hierarchique",
            "valideur_designe",
            "valideur_designe_nom",
            "nature",
            "actif",
        ]


class DecisionSerializer(serializers.Serializer):
    """Corps de requete des actions ``valider`` et ``rejeter``."""

    commentaire = serializers.CharField(required=False, allow_blank=True, default="")


class DocumentValidableSerializer(serializers.ModelSerializer):
    """Base des serializers de documents soumis au circuit de validation."""

    etapes = EtapeValidationSerializer(many=True, read_only=True)
    demandeur_nom = serializers.CharField(source="demandeur.get_full_name", read_only=True)
    # Le departement du demandeur suit le dossier : c'est par lui que les
    # decideurs classent leurs files.
    demandeur_departement = serializers.IntegerField(
        source="demandeur.departement_id", read_only=True
    )
    demandeur_departement_nom = serializers.CharField(
        source="demandeur.departement.nom", read_only=True, default=""
    )
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    etape_courante_libelle = serializers.SerializerMethodField()
    # Le demandeur peut-il encore corriger ou retirer son dossier ? L'API le
    # dit plutot que de laisser l'interface rejouer la regle de son cote :
    # elle ne connait ni les etapes pour information ni les statuts a venir.
    modifiable = serializers.SerializerMethodField()
    verrou_motif = serializers.SerializerMethodField()

    def get_etape_courante_libelle(self, obj):
        etape = obj.etape_courante
        return etape.libelle if etape else ""

    def get_modifiable(self, obj):
        return raison_verrou(obj) is None

    def get_verrou_motif(self, obj):
        return raison_verrou(obj) or ""
