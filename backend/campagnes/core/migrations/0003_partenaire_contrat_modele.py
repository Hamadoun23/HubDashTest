"""
Chaque client de GDA a son propre contrat de prestation.

Les engagements ne sont pas les mêmes d'un client à l'autre — ni le donneur
d'ordre, ni la carte vendue, ni les modalités de rémunération. Le partenaire
porte donc le nom d'un modèle de contrat, dont `campagnes.articles_defaut`
tient le registre.

La colonne nomme un modèle, elle ne stocke pas le texte : les clauses restent
dans le code, versionnées et relues, et les articles réellement signés sont
copiés dans `campagne_contrat_articles` à l'ouverture de chaque campagne.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [("core", "0002_types_cartes_partenaire")]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE `partenaires`
              ADD COLUMN `contrat_modele` varchar(30) NOT NULL DEFAULT 'gda_bdm'
              AFTER `fiche_adhesion`;
            """,
            reverse_sql="ALTER TABLE `partenaires` DROP COLUMN `contrat_modele`;",
        ),
        migrations.RunSQL(
            sql="UPDATE `partenaires` SET `contrat_modele` = 'gda_uba' WHERE `code` = 'uba';",
            reverse_sql="UPDATE `partenaires` SET `contrat_modele` = 'gda_bdm' WHERE `code` = 'uba';",
        ),
    ]
