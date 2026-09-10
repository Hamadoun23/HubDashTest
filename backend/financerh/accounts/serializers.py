from django.contrib.auth.password_validation import validate_password
from django.utils.crypto import get_random_string
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.models import Departement, Utilisateur


class UtilisateurResumeSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(source="get_full_name", read_only=True)

    class Meta:
        model = Utilisateur
        fields = ["id", "matricule", "nom_complet", "poste", "role"]


class DepartementSerializer(serializers.ModelSerializer):
    effectif = serializers.IntegerField(read_only=True)
    responsable_nom = serializers.CharField(
        source="responsable.get_full_name", read_only=True, default=""
    )

    class Meta:
        model = Departement
        fields = ["id", "code", "nom", "responsable", "responsable_nom", "effectif"]


class UtilisateurSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(source="get_full_name", read_only=True)
    departement_nom = serializers.CharField(
        source="departement.nom", read_only=True, default=""
    )
    manager_nom = serializers.CharField(
        source="manager.get_full_name", read_only=True, default=""
    )
    role_libelle = serializers.CharField(source="get_role_display", read_only=True)
    anciennete_mois = serializers.IntegerField(read_only=True)
    est_encadrant = serializers.BooleanField(read_only=True)
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "username",
            "password",
            "matricule",
            "first_name",
            "last_name",
            "nom_complet",
            "email",
            "telephone",
            "role",
            "role_libelle",
            "poste",
            "departement",
            "departement_nom",
            "manager",
            "manager_nom",
            "type_contrat",
            "date_embauche",
            "date_sortie",
            "motif_sortie",
            "anciennete_mois",
            "est_encadrant",
            "is_active",
        ]
        read_only_fields = ["matricule"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        utilisateur = Utilisateur(**validated_data)
        utilisateur.set_password(password or get_random_string(12))
        utilisateur.save()
        return utilisateur

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        utilisateur = super().update(instance, validated_data)
        if password:
            utilisateur.set_password(password)
            utilisateur.save(update_fields=["password"])
        return utilisateur


class ProfilSerializer(UtilisateurSerializer):
    """Profil de l'utilisateur connecte : champs de pilotage en lecture seule."""

    class Meta(UtilisateurSerializer.Meta):
        read_only_fields = [
            "matricule",
            "role",
            "departement",
            "manager",
            "type_contrat",
            "date_embauche",
            "date_sortie",
            "motif_sortie",
            "is_active",
        ]


class ConnexionSerializer(TokenObtainPairSerializer):
    """Ajoute le profil de l'agent a la reponse de connexion."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["utilisateur"] = UtilisateurSerializer(self.user).data
        return data


class ChangementMotDePasseSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_ancien_mot_de_passe(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["nouveau_mot_de_passe"])
        user.save(update_fields=["password"])
        return user
