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

Tout le reste du travail (CRUD, réconciliation backend/frontend, tableaux de
bord) a été fait sans Docker ni SQLite réel — vérifié par lecture de code et
appels HTTP simulés (Playwright avec `/api/**` mocké). **Rien n'a encore
tourné avec les 6 vrais services Django connectés au vrai frontend.** C'est
l'objet de ce test.

## Identité visuelle : le hub sombre, chaque app métier son propre style

Décision prise le 11/09/2026 (documentée dans `retrogradeAppmetier.md` du
dépôt `Hamadoun23/gdahub`, où une session parallèle est arrivée à la même
conclusion) : forcer un seul design sombre "Virtus" sur toutes les apps
métier était une erreur. **Seule la coquille du hub garde cet habillage** —
`src/pages/Accueil.tsx`, `src/pages/Administration.tsx`,
`src/pages/MonCompte.tsx`, `src/pages/Connexion.tsx`, `src/App.tsx`,
`src/components/Sidebar.tsx`, `src/components/TopBar.tsx`. Une fois dans une
app métier, elle affiche son **propre** habillage, distinct du hub et des
autres apps :

- **Jus d'orange** (`/jus/*`) — clair, sidebar blanche, accent orange
  `#eb6834`. Layout : `src/layouts/JusLayout.tsx`.
- **RH & Finance** (`/rh/*`) — clair, logo GD&A, orange de marque `#d03e0d`
  (texte/actions) / `#ff6a3a` (aplats). Layout : `src/layouts/RhLayout.tsx`.
- **Chantiers** (`/chantiers/*`) — bandeau sombre en entête, fond crème
  `#f4f1eb`, accent terracotta `#c8521a`, titres bruns `#381419`, statuts
  vert `#1a7a42` / bleu `#1a5c8a` / rouge `#c01a1a`. Layout :
  `src/layouts/ChantiersLayout.tsx` (+ `src/pages/chantiers/ChantierLayout.tsx`
  pour les onglets d'un chantier précis).
- **Planning** (`/planning/*`) — bandeau dégradé orange
  (`#ff8a5c → #ff6a3a → #e8481b`) avec onglets horizontaux, fond clair.
  Layout : `src/layouts/PlanningLayout.tsx`.
- **Campagnes** (`/campagnes/*`) — clair, sidebar violette `#7c3aed`.
  N'existe pas dans le dépôt `gdahub` de référence (cette app n'a jamais eu
  de vues React unifiées, elle servait à l'origine ses propres pages
  Django/Inertia) : pas de palette à reprendre, donc identité propre choisie
  en suivant le même principe que les 4 autres — surtout PAS l'habillage
  sombre de la coquille du hub, corrigé après un premier essai qui l'avait
  laissée par erreur sous `<App>`. Layout : `src/layouts/CampagnesLayout.tsx`.

La sidebar du hub (`src/components/Sidebar.tsx`) ne fait plus que **rediriger**
vers la racine de chaque app (`/rh`, `/jus/production`, `/chantiers`,
`/planning`, `/campagnes`) — plus de sous-menu déroulant dans le style sombre
une fois dans une app.

Un kit de composants clairs partagé par les 5 apps métier vit dans
`src/components/ui-light/` (`Card`, `PageHeader`, `StatTile`, `Badge`,
`TableVirtus`, `EtatChargement`/`EtatErreur`, `CircularProgress`,
`TrendChart`, `DualTrendChart`, `Avatar`/`AvatarStack`, `ProgressBar`,
`FormulaireEtHistorique`, `RapportGenerique`) — l'équivalent clair de
`src/components/ui/` (toujours utilisé tel quel par la coquille sombre du
hub, ne pas le supprimer). Toutes les pages sous `src/pages/{jus,rh,
chantiers,planning,campagnes}/` ont été reskinnées pour utiliser ce kit
clair ; aucune logique de récupération de données n'a changé.

**Vérifié en local dans cette session** (Playwright, backend mocké, pas de
vrai Django) : `tsc --noEmit` et `npm run build` propres, et un grep sur les
5 dossiers d'apps métier ne trouve plus aucune classe sombre résiduelle
(`text-white`/`bg-surface`/`border-border`/`bg-accent`/`text-accent`) hors
usages légitimes (texte blanc sur bouton plein coloré). **Jamais vérifié
avec les vrais services Django ni un vrai navigateur non automatisé** — à
faire ici.

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
# Campagnes — port 8006. CHEMIN_BASE=/campagnes EST nécessaire ici (contrairement
# à ce qu'on pourrait croire) : le proxy Vite du hub retire /campagnes avant
# d'atteindre Django, mais les redirections internes de Django (choix-client,
# login, etc.) ont besoin de CHEMIN_BASE pour se recomposer avec ce préfixe une
# fois relues par le navigateur, sinon elles sortent du chemin proxifié et 404.
# SESSION_COOKIE_PATH/CSRF_COOKIE_PATH sont forcés à "/" (et pas déduits de
# CHEMIN_BASE) car la page React du hub est servie à la racine, pas sous
# /campagnes — sans ça le cookie CSRF est invisible depuis le JS du hub.
# Sous Git Bash sur Windows, MSYS_NO_PATHCONV=1 est indispensable : sinon
# "/campagnes" est réécrit en chemin Windows (ex. "C:/campagnes") avant même
# d'atteindre Python.
cd backend/campagnes
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements.txt gunicorn
pip install -e ../../libs/gdahub_common
python manage.py migrate
export MSYS_NO_PATHCONV=1
export GDAHUB_JWKS_URL="http://localhost:8011/.well-known/jwks.json"  # ou le port réel d'identity
export CHEMIN_BASE="/campagnes"
export SESSION_COOKIE_NAME="campagnes_sessionid"
export CSRF_COOKIE_NAME="campagnes_csrftoken"
export SESSION_COOKIE_PATH="/"
export CSRF_COOKIE_PATH="/"
python manage.py runserver 8006
```

**Autres écarts SQLite découverts en la faisant tourner pour de vrai** :
- La quasi-totalité des tables (`core`, `campagnes`, `terrain`) sont
  `managed=False` : elles supposent un dump MySQL de prod déjà chargé et
  `migrate` ne les crée jamais sur une base vide. Pour un jeu de test local
  sans ce dump, il faut créer les tables « à la main » (passer
  `Model._meta.managed = True` le temps d'un `schema_editor.create_model()`
  par modèle, dans un script ponctuel — jamais dans les fichiers source) puis
  semer les données via l'ORM.
- `rapports/services.py::agreger_par_periode` utilisait du SQL brut
  MySQL (`YEARWEEK`, `DATE_FORMAT`) sans branche SQLite — corrigé avec un
  équivalent `strftime` approximatif (numérotation de semaine différente de
  l'ISO exact, sans conséquence en local).

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

## Étape 3 — Vérifier que chaque app affiche de vraies données ET son bon habillage

Pour chaque route ci-dessous, vérifier à la fois **les chiffres** (doivent
être ceux du seed, pas des zéros/NaN) et **l'habillage** (voir palettes
ci-dessus — un fond sombre "Virtus" en dehors de `/`, `/administration`,
`/mon-compte` ou `/campagnes` serait un régression à signaler) :

- `/` (accueil du hub, sombre) — congés, dossiers à valider, graphique à
  deux courbes
- `/rh`, `/rh/presences` (clair, orange marque) — solde de congés, pointages
- `/jus/commercial`, `/jus/production`, `/jus/finance`, `/jus/direction`,
  `/jus/reporting` (clair, orange `#eb6834`) — les 5 tableaux de bord
- `/chantiers` (bandeau sombre, fond crème) — avancement moyen, liste de
  projets
- `/planning` (bandeau dégradé orange, onglets horizontaux) —
  tournages/publications à venir
- `/campagnes` (clair, violet `#7c3aed`) — une fois la commande de seed écrite
- Cliquer sur chaque app depuis la sidebar du hub, puis sur "← GDA Hub" dans
  chaque app pour revenir — vérifier qu'aucun style ne "fuit" d'une app à
  l'autre au moment de la transition.

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
  que statiquement (relecture), jamais par exécution réelle — à surveiller
  en priorité.
- Motif obligatoire (≥10 caractères) pour Arrêter/Annuler/Reprogrammer une
  campagne ; justification obligatoire dès qu'un avancement de tâche
  augmente (Chantiers → Saisie du jour) — corrigés sans avoir pu revérifier
  après coup avec un vrai backend qui tourne.
- Le reskin des 4 apps métier (voir section ci-dessus) n'a été vérifié que
  par Playwright avec `/api/**` mocké, jamais avec les vrais services Django
  ni un œil humain sur un vrai navigateur — c'est le principal absent de
  cette session, et l'objet de ce test.
