#!/bin/sh
# Reprise des donnees de production dans les bases locales du hub.
#
#   sh infra/reprise-donnees.sh
#
# Les applications rassemblees demarrent avec des bases vides. Ce script y
# verse les sauvegardes de production, pour travailler sur les vraies donnees
# plutot que sur des jeux d'essai qui mentent toujours un peu.
#
# Il est destructeur et rejouable : chaque base est recreee a neuf, et rien de
# ce qui a ete saisi en local n'y survit. C'est voulu — une restauration
# par-dessus des donnees existantes produit des conflits de cles que personne
# ne sait demeler ensuite.
#
# Il ne touche jamais a la production : il ne fait que lire des fichiers deja
# telecharges.

set -e

racine=$(cd "$(dirname "$0")/.." && pwd)
reprise="$racine/infra/reprise"
docs="$racine/infra/reprise"
mdp=${POSTGRES_PASSWORD:-gdahub-local}

vert()  { printf '  ok    %s\n' "$1"; }
rouge() { printf '  !!    %s\n' "$1"; }
titre() { printf '\n== %s ==\n' "$1"; }

# Une base qui vient de demarrer refuse les connexions pendant quelques
# secondes : restaurer trop tot echoue sur la premiere instruction.
attendre() {
    essais=0
    while [ "$essais" -lt 60 ]; do
        if docker compose exec -T "$1" sh -c "$2" >/dev/null 2>&1; then
            vert "$1 repond"
            return 0
        fi
        essais=$((essais + 1))
        sleep 2
    done
    rouge "$1 ne repond pas apres deux minutes"
    return 1
}

titre "FinanceRH"
if [ -f "$reprise/financerh_prod.sql.gz" ]; then
    attendre db-financerh 'pg_isready -U financerh -d financerh'
    gzip -dc "$reprise/financerh_prod.sql.gz" |
        docker compose exec -T db-financerh psql -U financerh -d financerh -q
    vert 'base restauree'
else
    rouge "sauvegarde absente : $reprise/financerh_prod.sql.gz"
fi

titre "Jus d'orange"
sauvegarde=$(ls -t "$docs"/jusorange_prod_*.sql 2>/dev/null | head -1)
if [ -n "$sauvegarde" ]; then
    attendre db-jusorange 'pg_isready -U jusorange -d jusorange'
    # Les directives de restriction, posees par pg_dump 16, ne sont comprises
    # que par psql 16 et plus. On les retire : elles n'apportent rien ici.
    sed -e '/^.restrict /d' -e '/^.unrestrict /d' "$sauvegarde" |
        docker compose exec -T db-jusorange psql -U jusorange -d jusorange -q
    vert "base restauree depuis $(basename "$sauvegarde")"
else
    rouge "aucune sauvegarde jusorange_prod_*.sql dans $docs"
fi

titre "BDM"
sauvegarde=$(ls -t "$docs"/bdm_prod_*.sql 2>/dev/null | head -1)
if [ -n "$sauvegarde" ]; then
    attendre db-bdm 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD"'
    docker compose exec -T db-bdm mysql -uroot -p"$mdp" -e 'DROP DATABASE IF EXISTS bdm; CREATE DATABASE bdm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
    docker compose exec -T db-bdm mysql -uroot -p"$mdp" bdm < "$sauvegarde"
    vert "base restauree depuis $(basename "$sauvegarde")"
else
    rouge "aucune sauvegarde bdm_prod_*.sql dans $docs"
fi

titre 'Termine'
echo '  Les mots de passe restent ceux de la production : chaque agent garde le sien.'
echo '  Le compte unique du hub se cree a part :'
echo '    docker compose exec identity python manage.py amorcer'
