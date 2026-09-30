# Reprise des données de production dans le hub

Ordre des opérations (local d'abord, production ensuite, sur décision) :

1. **Exports** dans `DonneeEnProd/` (jamais versionné) :
   `gdamali_daily.sql`, `gdamali_planning_bd.sql` (phpMyAdmin), dump MySQL de
   BDM, sauvegardes Postgres de FinanceRH et Jus d'orange.
2. **Données métier**
   - Chantiers : `docker exec gdahub-chantiers python manage.py importer_daily /tmp/gdamali_daily.sql --oui`
   - Campagnes : `docker exec gdahub-campagnes python manage.py importer_bdm /tmp/bdm.sql --oui`
   - FinanceRH / Jus d'orange : restauration `psql` de la sauvegarde (même schéma), puis `migrate`.
   (Copier d'abord le fichier dans le conteneur avec `docker cp`.)
3. **Comptes du hub**
   - `sh scripts/reprise/extraire_utilisateurs.sh /tmp/comptes`
   - copier `/tmp/comptes` et `synchroniser_comptes.py` dans `gdahub-identity:/tmp/comptes/`
   - `docker exec gdahub-identity sh -c "python manage.py shell < /tmp/comptes/synchroniser_comptes.py"`
     (en test seulement : `-e MOT_DE_PASSE_UNIQUE=1234`)
4. **Classeur des comptes** : `python scripts/reprise/classeur_comptes.py /tmp/comptes DonneeEnProd/Comptes_GDA_Hub.xlsx 1234`

Tous les imports sont **destructifs** pour l'application visée : sauvegarder
la base avant, surtout en production.
