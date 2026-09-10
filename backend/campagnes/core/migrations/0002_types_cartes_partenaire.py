"""
Rattache le catalogue de cartes à son partenaire.

Sans cela, un commercial UBA se verrait proposer les cartes de la BDM à la
vente, et réciproquement : le formulaire de vente lit `types_cartes` sans autre
filtre. Les onze types existants sont ceux de la BDM.

La colonne reste nullable : un type sans partenaire est commun à tous les
clients, ce qui laisse la porte ouverte à un catalogue partagé.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [("core", "0001_partenaires")]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE `types_cartes`
              ADD COLUMN `partenaire_id` bigint unsigned DEFAULT NULL AFTER `id`,
              ADD KEY `types_cartes_partenaire_id_foreign` (`partenaire_id`),
              ADD CONSTRAINT `types_cartes_partenaire_id_foreign`
                FOREIGN KEY (`partenaire_id`) REFERENCES `partenaires` (`id`)
                ON DELETE SET NULL;
            """,
            reverse_sql="""
            ALTER TABLE `types_cartes`
              DROP FOREIGN KEY `types_cartes_partenaire_id_foreign`,
              DROP COLUMN `partenaire_id`;
            """,
        ),
        migrations.RunSQL(
            sql="UPDATE `types_cartes` SET `partenaire_id` = 1 WHERE `partenaire_id` IS NULL;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
