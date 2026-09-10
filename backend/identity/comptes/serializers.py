"""Representations JSON du service identity."""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as ValidationDjango
from django.utils import timezone
from rest_framework import serializers

from comptes.models import (
    Application,
    Habilitation,
    JournalConnexion,
    SessionJeton,
    Utilisateur,
)


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = [
            "id",
            "code",
            "nom",
            "description",
            "groupe",
            "chemin",
            "prefixe_api",
            "roles_disponibles",
            "couleur",
            "ordre",
            "active",
        ]


class HabilitationSerializer(serializers.ModelSerializer):
    application_code = serializers.CharField(source="application.code", read_only=True)
    application_nom = serializers.CharField(source="application.nom", read_only=True)

    class Meta:
        model = Habilitation
        fields = [
            "id",
            "utilisateur",
            "application",
            "application_code",
            "application_nom",
            "roles",
            # Sans lui, le compte unique ne fonctionne que pour les personnes
            # dont l'application connait deja l'adresse professionnelle. Les
            # autres — celles reprises depuis Laravel, celles qui n'ont pas
            # d'adresse du tout — ne sont rattachables que par ce champ, et il
            # n'etait joignable que par l'administration Django.
            "identifiant_local",
            "active",
            "accordee_le",
        ]
        read_only_fields = ["accordee_le"]

    def validate(self, donnees):
        """Un role accorde doit exister dans le catalogue de l'application.

        Sans ce controle, une faute de frappe cree un role qui n'ouvre rien et
        que personne ne remarque avant la reclamation de l'utilisateur.
        """
        application = donnees.get("application") or getattr(
            self.instance, "application", None
        )
        roles = donnees.get("roles")
        if application and roles is not None:
            connus = application.codes_de_roles()
            inconnus = sorted(set(roles) - connus)
            if inconnus:
                raise serializers.ValidationError(
                    {
                        "roles": f"Roles inconnus pour {application.code} : "
                        f"{', '.join(inconnus)}."
                    }
                )
        return donnees


class UtilisateurSerializer(serializers.ModelSerializer):
    """Fiche d'un compte, habilitations comprises."""

    nom_complet = serializers.CharField(read_only=True)
    habilitations = HabilitationSerializer(many=True, read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "identifiant",
            "nom",
            "prenom",
            "nom_complet",
            "email",
            "telephone",
            "fonction",
            "est_actif",
            "is_superuser",
            "derniere_connexion",
            "cree_le",
            "habilitations",
        ]
        read_only_fields = ["derniere_connexion", "cree_le"]


class UtilisateurEcritureSerializer(serializers.ModelSerializer):
    """Creation et modification d'un compte par un administrateur."""

    mot_de_passe = serializers.CharField(write_only=True, required=False, min_length=4)

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "identifiant",
            "nom",
            "prenom",
            "email",
            "telephone",
            "fonction",
            "est_actif",
            "is_superuser",
            "mot_de_passe",
        ]

    def validate_identifiant(self, valeur):
        return valeur.strip().lower()

    def validate_mot_de_passe(self, valeur):
        try:
            validate_password(valeur)
        except ValidationDjango as erreur:
            raise serializers.ValidationError(list(erreur.messages)) from erreur
        return valeur

    def create(self, donnees):
        mot_de_passe = donnees.pop("mot_de_passe", None)
        if not mot_de_passe:
            raise serializers.ValidationError(
                {"mot_de_passe": "Obligatoire a la creation du compte."}
            )
        return Utilisateur.objects.create_user(mot_de_passe=mot_de_passe, **donnees)

    def update(self, instance, donnees):
        mot_de_passe = donnees.pop("mot_de_passe", None)
        for champ, valeur in donnees.items():
            setattr(instance, champ, valeur)
        if mot_de_passe:
            instance.set_password(mot_de_passe)
            # Changer le mot de passe coupe les sessions ouvertes ailleurs.
            instance.sessions.filter(revoque_le__isnull=True).update(
                revoque_le=timezone.now()
            )
        instance.save()
        return instance


class ConnexionSerializer(serializers.Serializer):
    identifiant = serializers.CharField()
    mot_de_passe = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_identifiant(self, valeur):
        return valeur.strip().lower()


class RafraichissementSerializer(serializers.Serializer):
    rafraichissement = serializers.CharField()


class ChangementMotDePasseSerializer(serializers.Serializer):
    """Changement par l'utilisateur lui-meme : l'ancien est exige."""

    ancien = serializers.CharField(write_only=True)
    nouveau = serializers.CharField(write_only=True)

    def validate_nouveau(self, valeur):
        try:
            validate_password(valeur)
        except ValidationDjango as erreur:
            raise serializers.ValidationError(list(erreur.messages)) from erreur
        return valeur


class SessionSerializer(serializers.ModelSerializer):
    valide = serializers.BooleanField(read_only=True)

    class Meta:
        model = SessionJeton
        fields = ["id", "cree_le", "expire_le", "revoque_le", "adresse_ip", "agent", "valide"]


class JournalConnexionSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalConnexion
        fields = [
            "id",
            "identifiant_saisi",
            "utilisateur",
            "reussie",
            "motif",
            "adresse_ip",
            "agent",
            "date",
        ]
