from django.contrib import admin

from .models import ClientPlanning, ClientReport, ContentIdea, Publication, PublicationRule, Shooting


@admin.register(ClientPlanning)
class ClientPlanningAdmin(admin.ModelAdmin):
    list_display = ["nom_entreprise", "created_at"]
    search_fields = ["nom_entreprise"]


@admin.register(ContentIdea)
class ContentIdeaAdmin(admin.ModelAdmin):
    list_display = ["titre", "type", "created_at"]
    list_filter = ["type"]
    search_fields = ["titre"]


@admin.register(Shooting)
class ShootingAdmin(admin.ModelAdmin):
    list_display = ["client", "date", "status"]
    list_filter = ["status", "client"]
    date_hierarchy = "date"


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ["client", "date", "content_idea", "status"]
    list_filter = ["status", "client"]
    date_hierarchy = "date"


@admin.register(PublicationRule)
class PublicationRuleAdmin(admin.ModelAdmin):
    list_display = ["client", "day_of_week"]
    list_filter = ["day_of_week"]


@admin.register(ClientReport)
class ClientReportAdmin(admin.ModelAdmin):
    list_display = ["client", "report_type", "report_date", "uploaded_at"]
    list_filter = ["report_type"]
