#!/bin/sh
# Extrait les utilisateurs de chaque application en JSON (dossier $1, défaut
# ./comptes), pour synchroniser_comptes.py puis classeur_comptes.py.
# Chantiers et Planning sont lus dans leurs exports Laravel (DonneeEnProd/).
set -e
D=${1:-comptes}
mkdir -p "$D"
racine=$(cd "$(dirname "$0")/../.." && pwd)
# python3 sur les serveurs Linux, python ailleurs.
PY=$(command -v python3 || command -v python)

extraire() { # conteneur, code python qui imprime JSON=...
    printf '%s\n' "$2" | docker exec -i "$1" python manage.py shell 2>/dev/null | sed -n 's/^JSON=//p'
}

extraire gdahub-financerh "import json
from accounts.models import Utilisateur
print('JSON='+json.dumps([dict(email=u.email,username=u.username,prenom=u.first_name,nom=u.last_name,role=u.role,poste=u.poste) for u in Utilisateur.objects.filter(is_active=True)]))" > "$D/rh.json"

extraire gdahub-jusorange "import json
from django.contrib.auth.models import User
print('JSON='+json.dumps([dict(email=u.email,username=u.username,prenom=u.first_name,nom=u.last_name,groupes=[g.name for g in u.groups.all()],superuser=u.is_superuser) for u in User.objects.filter(is_active=True)]))" > "$D/jus.json"

extraire gdahub-campagnes "import json
from core.models import User
print('JSON='+json.dumps([dict(email=u.email,telephone=u.telephone,prenom=u.prenom,nom=u.name,role=u.role,partenaire=(u.partenaire.code if u.partenaire_id else None),agence=(u.agence.nom if u.agence_id else None)) for u in User.objects.select_related('partenaire','agence').filter(actif=True)]))" > "$D/campagnes.json"

"$PY" - "$racine" "$D" <<'EOF'
import json, sys
racine, D = sys.argv[1], sys.argv[2]
sys.path.insert(0, f"{racine}/backend/chantiers/chantiers")
from dump_mysql import lire_tables
daily = lire_tables(f"{racine}/DonneeEnProd/gdamali_daily.sql")
planning = lire_tables(f"{racine}/DonneeEnProd/gdamali_planning_bd.sql")
json.dump([{k: u.get(k) for k in ("id", "username", "name", "role")} for u in daily["users"]], open(f"{D}/daily.json", "w"))
json.dump([{k: u.get(k) for k in ("id", "username", "role", "client_id")} for u in planning["users"]], open(f"{D}/planning.json", "w"))
EOF
for f in rh jus campagnes daily planning; do printf '  %-10s %s\n' "$f" "$("$PY" -c "import json;print(len(json.load(open('$D/$f.json'))))")"; done
