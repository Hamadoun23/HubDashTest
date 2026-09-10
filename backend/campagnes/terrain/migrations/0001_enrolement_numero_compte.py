"""
Ajout de la colonne `numero_compte` sur `enrolement_clients`.

Les modèles terrain sont en `managed = False` (schéma hérité de Laravel) :
Django ne génère aucun DDL pour eux, la colonne est donc ajoutée en SQL
explicite. L'opération est purement additive et réversible.

La colonne est nullable en base : les enrôlements enregistrés avant l'ajout du
champ n'ont pas de numéro de compte. La saisie, elle, l'exige (cf.
`terrain.views.api_enrolement_store`).
"""

from django.db import migrations


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE `enrolement_clients` "
            "ADD COLUMN `numero_compte` VARCHAR(50) NULL AFTER `prenom`;",
            reverse_sql="ALTER TABLE `enrolement_clients` DROP COLUMN `numero_compte`;",
        ),
    ]
