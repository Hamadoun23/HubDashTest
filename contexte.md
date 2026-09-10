# Contexte pour la suite du travail (IDE local, sans Docker)

Ce fichier résume l'état du projet pour reprendre le travail en local, **sans
Docker** : chaque service Django tourne directement dans son propre venv sur
SQLite, le frontend tourne via `npm run dev`. C'est plus léger et plus rapide
à itérer que la pile Docker complète (`docker-compose.yml` reste dans le
dépôt pour un déploiement futur, mais n'est pas utilisé pour ce test local).

## État du dépôt

Copié depuis `Hamadoun23/virtus-dashboard` : frontend React/Vite (`src/`) + 6
services Django (`backend/`) + `libs/gdahub_common/` (socle partagé) +
`gateway/nginx.conf` (référence de routage, pas utilisé sans Docker). Voir
`README.md` pour la structure complète.

**Deux corrections apportées pour que ça tourne sur SQLite sans Docker :**
- `libs/gdahub_common/gdahub_common/reglages.py` (utilisé par `identity`) et
  `backend/campagnes/config/settings.py` ne basculaient pas proprement sur
  SQLite en l'absence de `DATABASE_URL`/`DB_HOST` — corrigé, les deux
  retombent maintenant sur SQLite par défaut, comme les 4 autres services.
- `backend/campagnes/config/settings.py` pointait encore vers l'ancien
  chemin `backend/frontend/dist` pour ses fichiers statiques compilés —
  corrigé vers `backend/campagnes-frontend/dist` (son emplacement réel dans
  ce dépôt fusionné).

Tout le reste du travail (CRUD, réconciliation backend/frontend, sidebar,
tableaux de bord) a été fait sans Docker ni SQLite réel — vérifié par lecture
de code et appels HTTP simulés. **Rien n'a encore tourné avec les 6 vrais
services connectés au frontend.** C'est l'objet de ce test.

## Étape 1 — Démarrer chaque service Django (un terminal par service)

Chaque service a son propre venv et sa propre base SQLite — pas de serveur
de base de données à installer.

```bash
# Identity — port 8001 (le compte unique, à démarrer en premier)
cd backend/identity
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
DJANGO_BASE_DIR=$(pwd) python manage.py migrate
DJANGO_BASE_DIR=$(pwd) python manage.py amorcer
DJANGO_BASE_DIR=$(pwd) python manage.py importer_comptes
DJANGO_BASE_DIR=$(pwd) python manage.py runserver 8001
```

```bash
# FinanceRH (RH + Finance) — port 8002
cd backend/financerh
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_configuration
python manage.py seed_personnel
python manage.py seed_demo --reset --mouvements   # pointages/retards pour Présences
python manage.py runserver 8002
```

```bash
# Jus d'orange — port 8003
cd backend/jusorange
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py create_users
python manage.py init_articles
python manage.py populate_sample
python manage.py runserver 8003
```

```bash
# Chantiers — port 8004
cd backend/chantiers
python3.11 -m venv .venv && source .venv/bin/activate   # 3.11 : Django plus ancien que les autres
pip install -r requirements.txt
python manage.py migrate
python manage.py donnees_test
python manage.py runserver 8004
```

```bash
# Planning — port 8005
cd backend/planning
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py donnees_test
python manage.py runserver 8005
```

```bash
# Campagnes — port 8006 (ne PAS définir CHEMIN_BASE en local : le proxy Vite
# retire déjà le préfixe /campagnes avant d'atteindre Django)
cd backend/campagnes
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt gunicorn
python manage.py migrate
python manage.py runserver 8006
```

**Campagnes n'a aucune commande de seed** (contrairement aux 5 autres
services) — à écrire :
`backend/campagnes/campagnes/management/commands/donnees_test.py`, même
pattern que Chantiers/Planning. Doit créer quelques campagnes
(`vente_carte` et `enrolement_app`), des agences, des commerciaux avec
habilitations, des ventes et enrôlements de démo — sinon `/campagnes` et son
tableau de bord (`venteTrend`, `classement`, `pctCommerciauxActifs`...)
resteront vides. Modèles dans `backend/campagnes/campagnes/models.py` et
`backend/campagnes/terrain/models.py`.

## Étape 2 — Démarrer le frontend

```bash
npm install
npm run dev
```

`vite.config.ts` proxifie déjà `/api/identity`, `/api/rh`, `/api/finance`,
`/api/auth`, `/api/jus`, `/api/chantiers`, `/api/planning` et `/campagnes`
vers les ports ci-dessus (8001-8006) — ça reproduit le routage de
`gateway/nginx.conf` sans avoir besoin de Docker ni de nginx. Si un port est
occupé sur la machine, ajuster à la fois le `runserver <port>` du service
concerné et l'objet `PORTS` en haut de `vite.config.ts`.

Aller sur `http://localhost:5173`. Compte super admin :
`hcisse@gdamali.net` / `admin`.

## Étape 3 — Vérifier que chaque tableau de bord affiche des vraies données

- `/` (accueil du hub) — congés, dossiers à valider, graphique à deux courbes
- `/rh`, `/rh/presences` — solde de congés, pointages
- `/jus/commercial`, `/jus/production`, `/jus/finance`, `/jus/direction`,
  `/jus/reporting` — les 5 tableaux de bord
- `/chantiers` — avancement moyen, liste de projets
- `/planning` — tournages/publications à venir
- `/campagnes` — une fois la commande de seed écrite

## Points d'attention déjà identifiés (à confirmer en conditions réelles)

- Le pont d'authentification hub → chaque service (`backend/*/**/hub.py`,
  JWT RS256 via JWKS) n'a jamais été testé avec un vrai navigateur — vérifier
  qu'un compte connecté au hub arrive bien authentifié sur chaque app. Sans
  gateway, `GDAHUB_JWKS_URL` (par défaut `http://identity:8000/...`, un nom
  Docker) doit être réglé sur `http://localhost:8001/.well-known/jwks.json`
  dans l'environnement de chaque service autre qu'identity.
- Le pont SSO Campagnes (cookie de session Django + JWT du hub, voir
  `src/lib/api/campagnesClient.ts`) n'a jamais tourné en conditions réelles.
- `backend/campagnes` est le seul service dont le code n'a pu être vérifié
  que statiquement (relecture), jamais par exécution réelle avant
  aujourd'hui — à surveiller en priorité.
- Motif obligatoire (≥10 caractères) pour Arrêter/Annuler/Reprogrammer une
  campagne ; justification obligatoire dès qu'un avancement de tâche
  augmente (Chantiers → Saisie du jour) — corrigés sans avoir pu revérifier
  après coup avec un vrai backend qui tourne.
