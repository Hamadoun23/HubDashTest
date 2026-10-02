#!/usr/bin/env sh
# Sécurise les secrets de GDA Hub en production — à lancer UNE fois, sur le
# serveur, dans /opt/hubdash, AVANT le premier déploiement qui utilise la
# version durcie de docker-compose.prod.yml.
#
#   sh infra/securiser-production.sh
#
# Pourquoi : jusqu'ici la production tournait sans fichier .env, donc avec la
# clé secrète Django par défaut et le mot de passe « gdahub-local » pour les
# six bases — deux valeurs écrites dans le dépôt. Le compose de production
# exige désormais DJANGO_SECRET_KEY et POSTGRES_PASSWORD, et refuse de
# démarrer sans eux.
#
# Ce que fait le script :
#   1. génère une clé secrète et un mot de passe de base forts ;
#   2. change le mot de passe de l'utilisateur de chaque base (ALTER USER),
#      pendant que les bases tournent encore avec l'ancien ;
#   3. écrit .env (droits 600).
# Il ne redémarre rien : lancer ensuite
#   docker compose -f docker-compose.prod.yml up -d --build
set -eu

if [ -f .env ]; then
  echo "Un fichier .env existe déjà : rien n'est modifié." >&2
  exit 1
fi

aleatoire() { head -c 48 /dev/urandom | base64 | tr -d '/+=\n' | head -c "$1"; }
CLE=$(aleatoire 64)
MDP=$(aleatoire 40)
CLE_INTERNE=$(aleatoire 48)

for paire in identity:gdahub financerh:financerh jusorange:jusorange chantiers:chantiers planning:planning campagnes:campagnes; do
  base=${paire%%:*}
  utilisateur=${paire##*:}
  echo "Base ${base} : changement du mot de passe de ${utilisateur}…"
  docker exec -i "gdahub-db-${base}" psql -v ON_ERROR_STOP=1 -U "${utilisateur}" -d "${base}" \
    -c "ALTER USER \"${utilisateur}\" WITH PASSWORD '${MDP}';" >/dev/null
done

umask 077
cat > .env <<EOF
# Secrets de GDA Hub — générés par infra/securiser-production.sh. Ne pas versionner.
DJANGO_SECRET_KEY=${CLE}
POSTGRES_PASSWORD=${MDP}
GDAHUB_CLE_INTERNE=${CLE_INTERNE}
GDAHUB_ADMIN_MOT_DE_PASSE=$(aleatoire 24)
EOF
echo "Fichier .env écrit. Redéployer : docker compose -f docker-compose.prod.yml up -d --build"
