"""
Sème les deux partenaires historiques (BDM, UBA).

Ce ne sont pas des données de démo : toute la logique de périmètre (agences,
campagnes, contrats) suppose leur existence — voir `Campagne.query_commerciaux_
perimetre`, `Partenaire.a_des_agences`. Reprend les valeurs des anciennes
migrations MySQL manuscrites (`0001_partenaires`, `0003_partenaire_contrat_
modele`), abandonnées avec le passage à Postgres (voir contexte.md).
"""

from django.db import migrations


def creer_partenaires(apps, schema_editor):
    Partenaire = apps.get_model("core", "Partenaire")
    Partenaire.objects.update_or_create(
        code="bdm",
        defaults={
            "nom": "BDM",
            "nom_complet": "Banque de Développement du Mali",
            "organisation": "agences",
            "fiche_adhesion": False,
            "contrat_modele": "gda_bdm",
            "ordre": 1,
            "actif": True,
        },
    )
    Partenaire.objects.update_or_create(
        code="uba",
        defaults={
            "nom": "UBA",
            "nom_complet": "United Bank for Africa Mali — carte GDA",
            "organisation": "commerciaux",
            "fiche_adhesion": True,
            "contrat_modele": "gda_uba",
            "ordre": 2,
            "actif": True,
        },
    )


def supprimer_partenaires(apps, schema_editor):
    Partenaire = apps.get_model("core", "Partenaire")
    Partenaire.objects.filter(code__in=["bdm", "uba"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(creer_partenaires, supprimer_partenaires),
    ]
