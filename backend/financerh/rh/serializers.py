import re
import unicodedata
from datetime import date, datetime, time

from rest_framework import serializers

from core.serializers import DocumentValidableSerializer
from rh.models import (
    CampagneEvaluation,
    CategorieAbsence,
    CritereEvaluation,
    DemandeAbsence,
    Evaluation,
    Formation,
    InscriptionFormation,
    NoteCritere,
    Presence,
    SoldeConge,
    StatutPresence,
    TypeAbsence,
)


class TypeAbsenceSerializer(serializers.ModelSerializer):
    categorie_libelle = serializers.CharField(source="get_categorie_display", read_only=True)

    class Meta:
        model = TypeAbsence
        fields = [
            "id",
            "code",
            "libelle",
            "categorie",
            "categorie_libelle",
            "decompte_solde",
            "duree_max_jours",
            "justificatif_requis",
            "actif",
        ]


class SoldeCongeSerializer(serializers.ModelSerializer):
    agent_nom = serializers.CharField(source="agent.get_full_name", read_only=True)
    # Contrairement aux montants finance, un solde de conges n'a pas besoin
    # d'une precision decimale exacte cote client : le frontend attend un
    # nombre JS, pas une chaine (voir `SoldeConges` dans `rh.ts`).
    jours_acquis = serializers.DecimalField(max_digits=5, decimal_places=1, coerce_to_string=False)
    jours_reportes = serializers.DecimalField(max_digits=5, decimal_places=1, coerce_to_string=False)
    jours_pris = serializers.DecimalField(max_digits=5, decimal_places=1, coerce_to_string=False)
    jours_restants = serializers.DecimalField(
        max_digits=5, decimal_places=1, read_only=True, coerce_to_string=False
    )

    class Meta:
        model = SoldeConge
        fields = [
            "id",
            "agent",
            "agent_nom",
            "annee",
            "jours_acquis",
            "jours_reportes",
            "jours_pris",
            "jours_restants",
        ]


class DemandeAbsenceSerializer(DocumentValidableSerializer):
    #: Le demandeur saisit son type en clair plutot que de le choisir dans une
    #: liste. Un libelle deja connu est reutilise (comparaison insensible a la
    #: casse) ; un libelle inedit cree un type que les RH auront a arbitrer.
    #: On conserve la cle etrangere derriere : c'est elle qui porte le
    #: decompte du solde, la duree maximale et l'exigence de justificatif.
    type_absence = serializers.CharField(max_length=120)
    type_absence_libelle = serializers.CharField(source="type_absence.libelle", read_only=True)
    categorie = serializers.CharField(source="type_absence.categorie", read_only=True)
    remplacant_nom = serializers.CharField(
        source="remplacant.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = DemandeAbsence
        fields = [
            "id",
            "numero",
            "demandeur",
            "demandeur_nom",
            "demandeur_departement",
            "demandeur_departement_nom",
            "type_absence",
            "type_absence_libelle",
            "categorie",
            "date_debut",
            "date_fin",
            "demi_journee",
            "heure_debut",
            "heure_fin",
            "nb_jours",
            "motif",
            "justificatif",
            "remplacant",
            "remplacant_nom",
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
        read_only_fields = [
            "numero",
            "demandeur",
            "nb_jours",
            "statut",
            "motif_rejet",
            "date_soumission",
        ]

    def validate_type_absence(self, valeur):
        """Rend le type connu correspondant, sinon le libelle nettoye.

        La creation du type est repoussee a ``create`` : la faire ici
        laisserait un type orphelin en base chaque fois qu'une autre regle du
        formulaire rejette la demande.
        """
        libelle = " ".join(valeur.split())
        if not libelle:
            raise serializers.ValidationError("Precisez le type d'absence.")
        return TypeAbsence.objects.filter(libelle__iexact=libelle).first() or libelle

    def validate(self, attrs):
        debut = attrs.get("date_debut", getattr(self.instance, "date_debut", None))
        fin = attrs.get("date_fin", getattr(self.instance, "date_fin", None))
        if debut and fin and fin < debut:
            raise serializers.ValidationError(
                {"date_fin": "La date de fin doit suivre la date de debut."}
            )

        type_absence = attrs.get("type_absence", getattr(self.instance, "type_absence", None))
        # Un libelle inedit est encore une chaine : il ne porte aucune regle,
        # il n'y a donc ni duree maximale ni justificatif a controler.
        if not isinstance(type_absence, TypeAbsence):
            return attrs

        if type_absence.duree_max_jours and debut and fin:
            duree = (fin - debut).days + 1
            if duree > type_absence.duree_max_jours:
                raise serializers.ValidationError(
                    {
                        "date_fin": (
                            f"Duree maximale pour ce type : "
                            f"{type_absence.duree_max_jours} jours (demande : {duree})."
                        )
                    }
                )
        if type_absence.justificatif_requis:
            justificatif = attrs.get(
                "justificatif", getattr(self.instance, "justificatif", None)
            )
            if not justificatif:
                raise serializers.ValidationError(
                    {"justificatif": "Un justificatif est obligatoire pour ce type d'absence."}
                )
        return attrs

    def create(self, validated_data):
        validated_data["type_absence"] = self._type_absence(validated_data["type_absence"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "type_absence" in validated_data:
            validated_data["type_absence"] = self._type_absence(
                validated_data["type_absence"]
            )
        return super().update(instance, validated_data)

    @staticmethod
    def _type_absence(valeur):
        """Materialise un libelle inedit en type d'absence."""
        if isinstance(valeur, TypeAbsence):
            return valeur
        return TypeAbsence.objects.create(
            libelle=valeur,
            code=DemandeAbsenceSerializer._code_disponible(valeur),
            categorie=CategorieAbsence.CONGE,
            # Tant que les RH n'ont pas arbitre ce type, il n'entame pas le
            # solde de conges : un decompte applique par defaut retirerait des
            # jours a un agent sur la foi d'un texte libre.
            decompte_solde=False,
        )

    @staticmethod
    def _code_disponible(libelle):
        sans_accent = (
            unicodedata.normalize("NFKD", libelle).encode("ascii", "ignore").decode()
        )
        base = re.sub(r"[^A-Z0-9]", "", sans_accent.upper())[:12] or "ABS"
        code = base
        suffixe = 1
        while TypeAbsence.objects.filter(code=code).exists():
            suffixe += 1
            code = f"{base}{suffixe}"
        return code


class PresenceSerializer(serializers.ModelSerializer):
    agent_nom = serializers.CharField(source="agent.get_full_name", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    # Nombre JS cote frontend (`Presence.heures_travaillees: number | null`
    # dans `rh.ts`), pas une chaine : voir la meme remarque sur SoldeConge.
    heures_travaillees = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True, coerce_to_string=False
    )

    class Meta:
        model = Presence
        fields = [
            "id",
            "agent",
            "agent_nom",
            "date",
            "heure_arrivee",
            "heure_depart",
            "statut",
            "statut_libelle",
            "retard_minutes",
            "heures_travaillees",
            "commentaire",
            "saisi_par",
        ]
        read_only_fields = ["retard_minutes", "saisi_par"]

    def _calculer_retard(self, heure_arrivee):
        if not heure_arrivee:
            return 0
        heures, minutes = Presence.HEURE_REFERENCE_ARRIVEE.split(":")
        reference = time(int(heures), int(minutes))
        if heure_arrivee <= reference:
            return 0
        base = date(2000, 1, 1)
        delta = datetime.combine(base, heure_arrivee) - datetime.combine(base, reference)
        return int(delta.total_seconds() // 60)

    def create(self, validated_data):
        validated_data["saisi_par"] = self.context["request"].user
        return super().create(self._appliquer_retard(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._appliquer_retard(validated_data, instance))

    def _appliquer_retard(self, validated_data, instance=None):
        heure_arrivee = validated_data.get(
            "heure_arrivee", getattr(instance, "heure_arrivee", None)
        )
        retard = self._calculer_retard(heure_arrivee)
        validated_data["retard_minutes"] = retard
        statut = validated_data.get("statut", getattr(instance, "statut", None))
        if retard and statut == StatutPresence.PRESENT:
            validated_data["statut"] = StatutPresence.RETARD
        return validated_data


class PointageSerializer(serializers.Serializer):
    """Corps des actions d'auto-pointage arrivee/depart."""

    heure = serializers.TimeField(required=False)
    commentaire = serializers.CharField(required=False, allow_blank=True, default="")


class CritereEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CritereEvaluation
        fields = ["id", "campagne", "libelle", "description", "poids"]


class CampagneEvaluationSerializer(serializers.ModelSerializer):
    criteres = CritereEvaluationSerializer(many=True, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    nb_evaluations = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = CampagneEvaluation
        fields = [
            "id",
            "libelle",
            "periode_debut",
            "periode_fin",
            "date_limite",
            "statut",
            "statut_libelle",
            "consignes",
            "criteres",
            "nb_evaluations",
        ]


class NoteCritereSerializer(serializers.ModelSerializer):
    critere_libelle = serializers.CharField(source="critere.libelle", read_only=True)
    poids = serializers.IntegerField(source="critere.poids", read_only=True)

    class Meta:
        model = NoteCritere
        fields = ["id", "critere", "critere_libelle", "poids", "note", "commentaire"]


class EvaluationSerializer(serializers.ModelSerializer):
    agent_nom = serializers.CharField(source="agent.get_full_name", read_only=True)
    evaluateur_nom = serializers.CharField(
        source="evaluateur.get_full_name", read_only=True, default=""
    )
    campagne_libelle = serializers.CharField(source="campagne.libelle", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    notes = NoteCritereSerializer(many=True, read_only=True)

    class Meta:
        model = Evaluation
        fields = [
            "id",
            "campagne",
            "campagne_libelle",
            "agent",
            "agent_nom",
            "evaluateur",
            "evaluateur_nom",
            "statut",
            "statut_libelle",
            "note_globale",
            "points_forts",
            "axes_amelioration",
            "objectifs",
            "commentaire_agent",
            "date_entretien",
            "notes",
        ]
        read_only_fields = ["note_globale"]


class SaisieNotesSerializer(serializers.Serializer):
    """Enregistre en une fois les notes de tous les criteres d'une evaluation."""

    notes = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate_notes(self, valeur):
        for ligne in valeur:
            if "critere" not in ligne or "note" not in ligne:
                raise serializers.ValidationError(
                    "Chaque ligne doit contenir 'critere' et 'note'."
                )
        return valeur


class InscriptionFormationSerializer(serializers.ModelSerializer):
    agent_nom = serializers.CharField(source="agent.get_full_name", read_only=True)
    formation_titre = serializers.CharField(source="formation.titre", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = InscriptionFormation
        fields = [
            "id",
            "formation",
            "formation_titre",
            "agent",
            "agent_nom",
            "statut",
            "statut_libelle",
            "note_satisfaction",
            "commentaire",
            "cree_le",
        ]
        read_only_fields = ["agent"]


class FormationSerializer(serializers.ModelSerializer):
    places_restantes = serializers.IntegerField(read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    nb_inscrits = serializers.SerializerMethodField()
    inscrit = serializers.SerializerMethodField()

    class Meta:
        model = Formation
        fields = [
            "id",
            "titre",
            "categorie",
            "description",
            "formateur",
            "organisme",
            "lieu",
            "date_debut",
            "date_fin",
            "places",
            "places_restantes",
            "nb_inscrits",
            "inscrit",
            "obligatoire",
            "departements_cibles",
            "statut",
            "statut_libelle",
        ]

    def get_nb_inscrits(self, obj):
        return obj.inscriptions.count()

    def get_inscrit(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.inscriptions.filter(agent=request.user).exists()
