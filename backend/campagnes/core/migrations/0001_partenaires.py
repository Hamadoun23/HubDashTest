"""
Introduit la notion de **partenaire** — le client de GDA.

GDA ne mène pas ses campagnes pour son compte : il les mène pour des banques.
Jusqu'ici l'application n'en connaissait qu'une, la BDM, et le partenaire était
donc implicite. L'arrivée de la carte GDA, émise avec UBA, rend cette hypothèse
fausse : deux campagnes coexistent, avec deux réseaux de commerciaux distincts
et des données qui ne doivent jamais se mélanger.

Trois rattachements suffisent à cloisonner l'ensemble : les agences, les
utilisateurs et les campagnes portent leur partenaire. Ventes, enrôlements et
clients héritent du leur par la campagne et par le commercial qui les saisit.

Deux écarts de schéma en découlent :

- `ventes.agence_id` et `enrolement_clients.agence_id` deviennent nullables.
  UBA n'a pas d'agences : ses commerciaux sont rattachés directement au
  partenaire. La colonne reste renseignée pour la BDM.
- La table `adhesions_cartes` porte la demande d'adhésion VISA prépayée exigée
  par UBA (cf. docs/UBA/). Elle complète la vente, elle ne la remplace pas :
  rapports et performances continuent de compter des `ventes`.

Comme les modèles métier sont en `managed = False`, tout passe par du SQL
explicite. Les opérations sont additives et réversibles.
"""

from django.db import migrations


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        # -- La table des partenaires ---------------------------------------
        migrations.RunSQL(
            sql="""
            CREATE TABLE `partenaires` (
              `id` bigint unsigned NOT NULL AUTO_INCREMENT,
              `code` varchar(30) NOT NULL,
              `nom` varchar(100) NOT NULL,
              `nom_complet` varchar(255) DEFAULT NULL,
              `organisation` varchar(20) NOT NULL DEFAULT 'agences',
              `fiche_adhesion` tinyint(1) NOT NULL DEFAULT '0',
              `ordre` int unsigned NOT NULL DEFAULT '0',
              `actif` tinyint(1) NOT NULL DEFAULT '1',
              `created_at` timestamp NULL DEFAULT NULL,
              `updated_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `partenaires_code_unique` (`code`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """,
            reverse_sql="DROP TABLE `partenaires`;",
        ),
        migrations.RunSQL(
            sql="""
            INSERT INTO `partenaires`
              (`id`, `code`, `nom`, `nom_complet`, `organisation`,
               `fiche_adhesion`, `ordre`, `actif`, `created_at`, `updated_at`)
            VALUES
              (1, 'bdm', 'BDM', 'Banque de Développement du Mali',
               'agences', 0, 1, 1, NOW(), NOW()),
              (2, 'uba', 'UBA', 'United Bank for Africa Mali — carte GDA',
               'commerciaux', 1, 2, 1, NOW(), NOW());
            """,
            reverse_sql="DELETE FROM `partenaires` WHERE `code` IN ('bdm','uba');",
        ),

        # -- Rattachement des agences ---------------------------------------
        migrations.RunSQL(
            sql="""
            ALTER TABLE `agences`
              ADD COLUMN `partenaire_id` bigint unsigned DEFAULT NULL AFTER `id`,
              ADD KEY `agences_partenaire_id_foreign` (`partenaire_id`),
              ADD CONSTRAINT `agences_partenaire_id_foreign`
                FOREIGN KEY (`partenaire_id`) REFERENCES `partenaires` (`id`)
                ON DELETE SET NULL;
            """,
            reverse_sql="""
            ALTER TABLE `agences`
              DROP FOREIGN KEY `agences_partenaire_id_foreign`,
              DROP COLUMN `partenaire_id`;
            """,
        ),
        migrations.RunSQL(
            # Toutes les agences existantes sont celles de la BDM.
            sql="UPDATE `agences` SET `partenaire_id` = 1 WHERE `partenaire_id` IS NULL;",
            reverse_sql=migrations.RunSQL.noop,
        ),

        # -- Rattachement des utilisateurs ----------------------------------
        migrations.RunSQL(
            sql="""
            ALTER TABLE `users`
              ADD COLUMN `partenaire_id` bigint unsigned DEFAULT NULL AFTER `agence_id`,
              ADD KEY `users_partenaire_id_foreign` (`partenaire_id`),
              ADD CONSTRAINT `users_partenaire_id_foreign`
                FOREIGN KEY (`partenaire_id`) REFERENCES `partenaires` (`id`)
                ON DELETE SET NULL;
            """,
            reverse_sql="""
            ALTER TABLE `users`
              DROP FOREIGN KEY `users_partenaire_id_foreign`,
              DROP COLUMN `partenaire_id`;
            """,
        ),
        migrations.RunSQL(
            # Les commerciaux existants travaillent tous pour la BDM. Les
            # administrateurs et la direction restent sans partenaire : ce sont
            # eux qui basculent d'un client à l'autre.
            sql="""
            UPDATE `users` SET `partenaire_id` = 1
             WHERE `partenaire_id` IS NULL
               AND `role` IN ('commercial', 'commercial_telephonique');
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),

        # -- Rattachement des campagnes -------------------------------------
        migrations.RunSQL(
            sql="""
            ALTER TABLE `campagnes`
              ADD COLUMN `partenaire_id` bigint unsigned DEFAULT NULL AFTER `id`,
              ADD KEY `campagnes_partenaire_id_foreign` (`partenaire_id`),
              ADD CONSTRAINT `campagnes_partenaire_id_foreign`
                FOREIGN KEY (`partenaire_id`) REFERENCES `partenaires` (`id`)
                ON DELETE SET NULL;
            """,
            reverse_sql="""
            ALTER TABLE `campagnes`
              DROP FOREIGN KEY `campagnes_partenaire_id_foreign`,
              DROP COLUMN `partenaire_id`;
            """,
        ),
        migrations.RunSQL(
            sql="UPDATE `campagnes` SET `partenaire_id` = 1 WHERE `partenaire_id` IS NULL;",
            reverse_sql=migrations.RunSQL.noop,
        ),

        # -- L'agence devient facultative sur les saisies terrain -----------
        migrations.RunSQL(
            sql="ALTER TABLE `ventes` MODIFY COLUMN `agence_id` bigint unsigned DEFAULT NULL;",
            reverse_sql="ALTER TABLE `ventes` MODIFY COLUMN `agence_id` bigint unsigned NOT NULL;",
        ),
        migrations.RunSQL(
            sql="ALTER TABLE `enrolement_clients` "
            "MODIFY COLUMN `agence_id` bigint unsigned DEFAULT NULL;",
            reverse_sql="ALTER TABLE `enrolement_clients` "
            "MODIFY COLUMN `agence_id` bigint unsigned NOT NULL;",
        ),

        # -- La demande d'adhésion carte prépayée ---------------------------
        migrations.RunSQL(
            sql="""
            CREATE TABLE `adhesions_cartes` (
              `id` bigint unsigned NOT NULL AUTO_INCREMENT,
              `vente_id` bigint unsigned NOT NULL,
              `client_id` bigint unsigned NOT NULL,
              `campagne_id` bigint unsigned DEFAULT NULL,
              `user_id` bigint unsigned NOT NULL,
              `nom` varchar(255) NOT NULL,
              `prenoms` varchar(255) NOT NULL,
              `date_naissance` date DEFAULT NULL,
              `lieu_naissance` varchar(191) DEFAULT NULL,
              `nationalite` varchar(100) DEFAULT NULL,
              `telephone` varchar(20) DEFAULT NULL,
              `email` varchar(191) DEFAULT NULL,
              `adresse` varchar(255) DEFAULT NULL,
              `pays_residence` varchar(100) DEFAULT NULL,
              `ville` varchar(100) DEFAULT NULL,
              `quartier` varchar(100) DEFAULT NULL,
              `nom_sur_carte` varchar(100) DEFAULT NULL,
              `piece_type` varchar(20) DEFAULT NULL,
              `piece_numero` varchar(100) DEFAULT NULL,
              `piece_delivree_le` date DEFAULT NULL,
              `piece_expire_le` date DEFAULT NULL,
              `piece_autorite` varchar(191) DEFAULT NULL,
              `numero_compte_uba` varchar(50) DEFAULT NULL,
              `profession` varchar(191) DEFAULT NULL,
              `employeur` varchar(191) DEFAULT NULL,
              `created_at` timestamp NULL DEFAULT NULL,
              `updated_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `adhesions_cartes_vente_id_unique` (`vente_id`),
              KEY `adhesions_cartes_client_id_foreign` (`client_id`),
              KEY `adhesions_cartes_campagne_id_foreign` (`campagne_id`),
              KEY `adhesions_cartes_user_id_foreign` (`user_id`),
              CONSTRAINT `adhesions_cartes_vente_id_foreign`
                FOREIGN KEY (`vente_id`) REFERENCES `ventes` (`id`) ON DELETE CASCADE,
              CONSTRAINT `adhesions_cartes_client_id_foreign`
                FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
              CONSTRAINT `adhesions_cartes_campagne_id_foreign`
                FOREIGN KEY (`campagne_id`) REFERENCES `campagnes` (`id`) ON DELETE SET NULL,
              CONSTRAINT `adhesions_cartes_user_id_foreign`
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """,
            reverse_sql="DROP TABLE `adhesions_cartes`;",
        ),
    ]
