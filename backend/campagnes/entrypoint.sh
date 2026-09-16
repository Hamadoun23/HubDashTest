#!/bin/sh
set -e

# Les fichiers statiques sont exposés à nginx par un volume partagé. Docker
# n'initialise un volume nommé qu'à sa création : sans cette resynchronisation
# au démarrage, nginx continuerait de servir les assets de la version
# précédente, et répondrait 404 sur les fichiers au nouveau hachage.
python manage.py collectstatic --noinput --clear >/dev/null
echo "Fichiers statiques resynchronisés."

exec "$@"
