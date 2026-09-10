from rest_framework import serializers

from .models import ClientPlanning, ClientReport, ContentIdea, Publication, PublicationRule, Shooting


class ContentIdeaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentIdea
        fields = ["id", "titre", "type", "created_at"]


class PublicationRuleSerializer(serializers.ModelSerializer):
    day_of_week_libelle = serializers.CharField(source="get_day_of_week_display", read_only=True)

    class Meta:
        model = PublicationRule
        fields = ["id", "client", "day_of_week", "day_of_week_libelle"]
        read_only_fields = ["client"]


class ClientPlanningSerializer(serializers.ModelSerializer):
    tournages_count = serializers.IntegerField(source="tournages.count", read_only=True)
    publications_count = serializers.IntegerField(source="publications.count", read_only=True)

    class Meta:
        model = ClientPlanning
        fields = ["id", "nom_entreprise", "created_at", "tournages_count", "publications_count"]


class ShootingSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_entreprise", read_only=True)
    content_ideas_detail = ContentIdeaSerializer(source="content_ideas", many=True, read_only=True)
    content_idea_ids = serializers.PrimaryKeyRelatedField(
        source="content_ideas", queryset=ContentIdea.objects.all(), many=True, write_only=True, required=False
    )
    is_overdue = serializers.SerializerMethodField()
    is_upcoming = serializers.SerializerMethodField()
    requires_action = serializers.SerializerMethodField()

    class Meta:
        model = Shooting
        fields = [
            "id", "client", "client_nom", "date", "status", "status_reason", "description",
            "content_ideas_detail", "content_idea_ids", "created_at",
            "is_overdue", "is_upcoming", "requires_action",
        ]

    def get_is_overdue(self, obj):
        return obj.is_overdue()

    def get_is_upcoming(self, obj):
        return obj.is_upcoming()

    def get_requires_action(self, obj):
        return obj.requires_action()

    def create(self, validated_data):
        idees = validated_data.pop("content_ideas", [])
        tournage = Shooting.objects.create(**validated_data)
        if idees:
            tournage.content_ideas.set(idees)
        return tournage

    def update(self, instance, validated_data):
        idees = validated_data.pop("content_ideas", None)
        for champ, valeur in validated_data.items():
            setattr(instance, champ, valeur)
        instance.save()
        if idees is not None:
            instance.content_ideas.set(idees)
        return instance


class PublicationSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_entreprise", read_only=True)
    content_idea_detail = ContentIdeaSerializer(source="content_idea", read_only=True)
    shooting_date = serializers.DateTimeField(source="shooting.date", read_only=True)
    is_overdue = serializers.SerializerMethodField()
    is_upcoming = serializers.SerializerMethodField()
    requires_action = serializers.SerializerMethodField()
    day_not_recommended_warning = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = [
            "id", "client", "client_nom", "date", "content_idea", "content_idea_detail",
            "shooting", "shooting_date", "status", "status_reason", "description", "created_at",
            "is_overdue", "is_upcoming", "requires_action", "day_not_recommended_warning",
        ]

    def get_is_overdue(self, obj):
        return obj.is_overdue()

    def get_is_upcoming(self, obj):
        return obj.is_upcoming()

    def get_requires_action(self, obj):
        return obj.requires_action()

    def get_day_not_recommended_warning(self, obj):
        return obj.get_day_not_recommended_warning()


class ClientReportSerializer(serializers.ModelSerializer):
    report_type_libelle = serializers.SerializerMethodField()
    file_url = serializers.FileField(source="file", read_only=True)

    class Meta:
        model = ClientReport
        fields = [
            "id", "client", "report_type", "report_type_libelle", "report_date",
            "file", "file_url", "original_filename", "file_size", "uploaded_at",
        ]
        read_only_fields = ["client", "original_filename", "file_size", "uploaded_at", "file_url"]
        extra_kwargs = {"file": {"write_only": True}}

    def get_report_type_libelle(self, obj):
        return "Mensuel" if obj.report_type == "monthly" else "Annuel"

    def create(self, validated_data):
        fichier = validated_data["file"]
        validated_data["original_filename"] = fichier.name
        validated_data["file_size"] = fichier.size
        return super().create(validated_data)
