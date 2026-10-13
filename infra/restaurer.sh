#!/bin/bash
# Restaure une base de GDA Hub depuis une sauvegarde de infra/sauvegarde.sh.
#
#   sudo /opt/hubdash/infra/restaurer.sh <dossier de sauvegarde> <service> [--essai]
#   ex. : sudo /opt/hubdash/infra/restaurer.sh /var/backups/gdahub/2026-10-13_0230 financerh
#
# <service> : identity, financerh, jusorange, chantiers, planning ou campagnes.
# --essai   : restaure dans une base temporaire « <base>_essai » (rien n'est
#             touché), affiche le nombre de tables, puis la supprime.
# Sans --essai, la base en service est REMPLACÉE : une sauvegarde de l'état
# actuel est faite juste avant, à côté de celle restaurée.
# Les fichiers : copier fichiers/<volume>/ vers /var/lib/docker/volumes/gdahub_<volume>/_data/.
set -euo pipefail
SOURCE=${1:?dossier de sauvegarde}; SERVICE=${2:?service}; MODE=${3:-}
FICHIER="$SOURCE/bases/$SERVICE.sql.gz"
CONTENEUR="gdahub-db-$SERVICE"
[ -s "$FICHIER" ] || { echo "Introuvable : $FICHIER"; exit 1; }
gunzip -t "$FICHIER"
BASE=$(docker exec "$CONTENEUR" sh -c 'echo $POSTGRES_DB')

if [ "$MODE" = "--essai" ]; then
  docker exec "$CONTENEUR" sh -c "psql -U \$POSTGRES_USER -d postgres -qc 'drop database if exists ${BASE}_essai' -c 'create database ${BASE}_essai'"
  gunzip -c "$FICHIER" | docker exec -i "$CONTENEUR" sh -c "psql -U \$POSTGRES_USER -d ${BASE}_essai -q -v ON_ERROR_STOP=0" >/dev/null 2>&1
  echo "Essai : $(docker exec "$CONTENEUR" sh -c "psql -U \$POSTGRES_USER -d ${BASE}_essai -Atc \"select count(*) from information_schema.tables where table_schema='public'\"") tables restaurées dans ${BASE}_essai."
  docker exec "$CONTENEUR" sh -c "psql -U \$POSTGRES_USER -d postgres -qc 'drop database ${BASE}_essai'"
  echo "Base d'essai supprimée."
  exit 0
fi

read -r -p "Remplacer la base $BASE en service par $FICHIER ? Tapez « oui » : " ok
[ "$ok" = "oui" ] || { echo "Annulé."; exit 1; }
AVANT="$SOURCE/bases/$SERVICE.avant-restauration-$(date +%Y%m%d_%H%M).sql.gz"
docker exec "$CONTENEUR" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' | gzip > "$AVANT"
echo "État actuel sauvegardé : $AVANT"
docker stop "gdahub-$SERVICE" >/dev/null || true
gunzip -c "$FICHIER" | docker exec -i "$CONTENEUR" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q'
docker start "gdahub-$SERVICE" >/dev/null
echo "Base $BASE restaurée depuis $FICHIER."
