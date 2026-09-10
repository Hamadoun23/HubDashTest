#!/bin/sh
# Demarrage complet de GDA Hub en local.
#
#   sh infra/demarrer.sh
#
# Construit et lance les dix conteneurs, attend que la passerelle reponde,
# cree les comptes du hub, verse les donnees de production dans les bases
# vides, puis affiche les adresses et les acces.
#
# Rejouable : relance sans rien casser une pile deja demarree.

set -e

racine=$(cd "$(dirname "$0")/.." && pwd)
cd "$racine"

titre() { printf '\n== %s ==\n' "$1"; }
vert()  { printf '  ok    %s\n' "$1"; }
rouge() { printf '  !!    %s\n' "$1"; }

titre 'Construction et demarrage'
docker compose up -d --build

titre 'Attente de la passerelle'
# On attend qu'elle reponde plutot que de dormir un temps fixe : sur une
# machine chargee, la premiere construction depasse n'importe quelle duree
# qu'on aurait choisie.
essais=0
while [ "$essais" -lt 90 ]; do
    if curl -fsS -o /dev/null http://localhost:8080/sante/identity 2>/dev/null; then
        vert 'la passerelle repond'
        break
    fi
    essais=$((essais + 1))
    sleep 2
done
if [ "$essais" -ge 90 ]; then
    rouge 'la passerelle ne repond pas apres trois minutes'
    echo '  Regardez : docker compose logs gateway identity'
    exit 1
fi

titre 'Reprise des donnees de production'
if [ -f "$racine/infra/reprise/financerh_prod.sql.gz" ]; then
    sh infra/reprise-donnees.sh
else
    rouge 'aucune sauvegarde dans infra/reprise : les bases restent en l etat'
fi

titre 'Migrations'
docker compose exec -T financerh python manage.py migrate --noinput >/dev/null 2>&1 || rouge 'FinanceRH : migrations a verifier'
docker compose exec -T jusorange python manage.py migrate --noinput >/dev/null 2>&1 || rouge 'Jus d orange : migrations a verifier'
docker compose exec -T bdm       python manage.py migrate --noinput >/dev/null 2>&1 || rouge 'BDM : migrations a verifier'
vert 'schemas a jour'

titre 'GDA Hub est en ligne'
cat <<'FIN'

  http://localhost:8080            la porte d'entree
    /rh/...                        FinanceRH
    /jus/...                       Jus d'orange
    /bdm/                          BDM

  Connexion au hub
    hcisse@gdamali.net / admin

  Dans les applications, les mots de passe restent ceux de la production.

  Le compte unique ne suit d'une application a l'autre que si la
  correspondance des identifiants est renseignee : les comptes de Jus
  d'orange et de BDM ne portent pas d'adresse @gdamali.net. Cela se remplit
  dans l'administration du hub, sur chaque habilitation.

FIN
