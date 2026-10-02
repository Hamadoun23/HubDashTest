#!/bin/sh
# Demarrage du service identity en developpement.
#
# Trois etapes, dans cet ordre : la paire de cles RSA (sans elle aucun jeton
# n'est signable), le schema, puis le jeu de donnees minimal — les quatre
# applications de GDA Hub et un compte administrateur.
set -e

echo "[identity] cles de signature"
python manage.py generer_cles

echo "[identity] migrations"
# Les migrations sont versionnees dans le depot : le demarrage se contente
# de les appliquer. Une image de production ne genere pas son schema, et un
# `makemigrations` au demarrage masquerait un modele modifie sans migration.
python manage.py migrate --noinput

echo "[identity] donnees de depart"
python manage.py amorcer

# Confort de developpement : l'ERP demarre avec un effectif a l'ecran plutot
# qu'un annuaire vide. Idempotent, et sans effet sur les mots de passe deja
# personnalises. A retirer d'une image de production, ou l'import est une
# operation decidee.
echo "[identity] comptes de l'effectif"
# L'echec n'arrete pas le demarrage : un fichier d'effectif absent est une
# gene, pas une panne. Sans ce garde-fou, « set -e » tuait le service et la
# passerelle repondait 502 sur toute l'origine — pour un annuaire vide.
# Jamais en production (DJANGO_DEBUG=False) : il recreerait a chaque
# demarrage des comptes de demonstration au mot de passe connu.
if [ "${DJANGO_DEBUG:-True}" = "True" ]; then
  python manage.py importer_comptes --mot-de-passe "${GDAHUB_MOT_DE_PASSE_INITIAL:-1234}" \
    || echo "[identity] effectif non importe, on continue"
else
  echo "[identity] production : import de l'effectif ignore"
fi


echo "[identity] demarrage"
exec python manage.py runserver 0.0.0.0:8000
