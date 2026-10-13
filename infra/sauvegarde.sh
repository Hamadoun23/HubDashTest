#!/bin/bash
# Sauvegarde nocturne de GDA Hub (lancée par /etc/cron.d/gdahub-sauvegarde).
#
#   sudo /opt/hubdash/infra/sauvegarde.sh
#
# Ce qui est sauvegardé, dans $RACINE/AAAA-MM-JJ_HHMM/ :
#   bases/<service>.sql.gz   les 6 bases PostgreSQL (pg_dump complet, format SQL)
#   fichiers/<volume>/       les volumes de fichiers (justificatifs, photos,
#                            pièces d'identité…), en instantanés rsync : un
#                            fichier inchangé n'occupe de place qu'une fois
#                            (liens durs vers la sauvegarde précédente)
#   secrets/                 le .env et les clés de signature (volume cles)
#   MANIFESTE.txt            contenu, tailles, empreintes, version du code
#
# Conservation : 7 jours, puis 1 par semaine (dimanche) pendant 4 semaines,
# puis 1 par mois (le 1er) pendant 6 mois. En cas d'échec, les
# super-administrateurs du hub reçoivent une notification.
#
# Restauration : voir docs/DOCUMENTATION.md, « Sauvegardes et restauration ».
set -uo pipefail

RACINE=${GDAHUB_SAUVEGARDES:-/var/backups/gdahub}
HUB=/opt/hubdash
SERVICES="identity financerh jusorange chantiers planning campagnes"
VOLUMES="media-identity media-financerh media-jusorange media-chantiers media-planning media-campagnes-app cles"
DATE=$(date +%Y-%m-%d_%H%M)
CIBLE="$RACINE/$DATE"
ERREURS=()

journal() { echo "$(date '+%F %T') $*"; }
erreur() { ERREURS+=("$*"); journal "ERREUR : $*"; }

alerter() {
  local message="$1"
  docker exec -i gdahub-identity python manage.py shell >/dev/null 2>&1 <<PY || true
from comptes.models import Utilisateur
from comptes.notifications import notifier
admins = list(Utilisateur.objects.filter(is_superuser=True, est_actif=True))
notifier(admins, titre="Sauvegarde GDA Hub en échec", message="""$message"""[:300], lien="/administration")
PY
}

umask 077
mkdir -p "$CIBLE/bases" "$CIBLE/fichiers" "$CIBLE/secrets"
chmod 700 "$RACINE"
journal "Début de la sauvegarde dans $CIBLE"

# --- Bases --------------------------------------------------------------------
for s in $SERVICES; do
  fichier="$CIBLE/bases/$s.sql.gz"
  if docker exec "gdahub-db-$s" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' 2>"$CIBLE/bases/$s.erreur" | gzip -9 > "$fichier" \
     && [ "$(gunzip -c "$fichier" | head -c 100 | wc -c)" -gt 0 ] && gunzip -t "$fichier"; then
    rm -f "$CIBLE/bases/$s.erreur"
  else
    erreur "base $s : $(head -c 200 "$CIBLE/bases/$s.erreur" 2>/dev/null)"
  fi
done

# --- Fichiers (instantanés incrémentaux) ------------------------------------
PRECEDENTE=$(ls -1d "$RACINE"/20*/ 2>/dev/null | grep -v "/$DATE/" | tail -1)
for v in $VOLUMES; do
  source="/var/lib/docker/volumes/gdahub_$v/_data/"
  [ -d "$source" ] || { erreur "volume gdahub_$v introuvable"; continue; }
  if [ "$v" = "cles" ]; then
    rsync -a "$source" "$CIBLE/secrets/cles/" || erreur "copie des clés"
    continue
  fi
  lien=()
  [ -n "$PRECEDENTE" ] && [ -d "${PRECEDENTE}fichiers/$v" ] && lien=(--link-dest="${PRECEDENTE}fichiers/$v/")
  rsync -a --delete "${lien[@]}" "$source" "$CIBLE/fichiers/$v/" || erreur "copie du volume $v"
done

# --- Secrets ------------------------------------------------------------------
cp "$HUB/.env" "$CIBLE/secrets/env" 2>/dev/null || erreur "copie du .env"

# --- Manifeste ----------------------------------------------------------------
{
  echo "Sauvegarde GDA Hub du $DATE"
  echo "Code : $(git -C "$HUB" log --oneline -1 2>/dev/null)"
  echo
  echo "== Bases"; (cd "$CIBLE/bases" && ls -la *.sql.gz 2>/dev/null && sha256sum *.sql.gz 2>/dev/null)
  echo; echo "== Fichiers"; for v in $VOLUMES; do [ "$v" = cles ] || echo "$v : $(find "$CIBLE/fichiers/$v" -type f 2>/dev/null | wc -l) fichiers"; done
  echo; echo "== Erreurs : ${#ERREURS[@]}"; printf '%s\n' "${ERREURS[@]}"
} > "$CIBLE/MANIFESTE.txt"

# --- Conservation -------------------------------------------------------------
maintenant=$(date +%s)
for d in "$RACINE"/20*/; do
  nom=$(basename "$d"); jour=${nom%%_*}
  age=$(( (maintenant - $(date -d "$jour" +%s)) / 86400 ))
  semaine=$(date -d "$jour" +%u); quantieme=$(date -d "$jour" +%d)
  if [ "$age" -le 7 ] \
     || { [ "$semaine" = 7 ] && [ "$age" -le 28 ]; } \
     || { [ "$quantieme" = 01 ] && [ "$age" -le 183 ]; }; then
    continue
  fi
  rm -rf "$d" && journal "Supprimée (conservation) : $nom"
done

taille=$(du -sh "$CIBLE" | cut -f1)
if [ ${#ERREURS[@]} -gt 0 ]; then
  alerter "$DATE : ${#ERREURS[@]} erreur(s). ${ERREURS[*]}"
  journal "Terminé avec ${#ERREURS[@]} erreur(s) ($taille)"
  exit 1
fi
journal "Terminé sans erreur ($taille, disque : $(df -h "$RACINE" | awk 'NR==2{print $5}') utilisé)"
