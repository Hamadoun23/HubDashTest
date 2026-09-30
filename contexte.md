# REPRISE — état au 30/09/2026 (à lire en premier)

> Écrit pour reprendre le travail avec un autre compte Claude. Tout est **en
> local, non commité, non poussé**. L'utilisateur l'a rappelé explicitement :
> **ne rien pousser en production ni sur GitHub sans demande explicite**, et ne
> pas toucher au VPS (`ssh pulsemotors-vps`, `/opt/hubdash`) sans demande.
> Répondre à l'utilisateur **en français**.

## Environnement

- Tout tourne en Docker : `docker compose up -d` (`docker-compose.yml`),
  passerelle sur **http://localhost:8080** (interface Vite + 6 backends Django :
  identity, financerh, jusorange, chantiers, planning, campagnes).
- Docker Desktop s'arrête parfois : le relancer
  (`Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`).
- Machine très lente (≈ 42 conteneurs d'autres projets : farafina, bekstpro qui
  redémarre en boucle, bdm_db_dev…) : prévoir de longs délais dans les tests
  navigateur. Proposé à l'utilisateur de les arrêter : pas encore de réponse.
- Après modification de `vite.config.ts` / `tailwind.config.js`, redémarrer
  `gdahub-frontend` si des classes Tailwind manquent.
- Nouvelles dépendances npm : react-chartjs-2, clsx, tailwind-merge, ziggy-js,
  @fontsource/inter, axios, @tailwindcss/forms (dev). Dans le conteneur :
  `docker exec gdahub-frontend npm install`.
- identity : `pywebpush==2.0.3` ajouté à `requirements.txt` (image reconstruite).

## Travail fait (tout non commité)

### 1. Chantiers (daily) — terminé
Rapport PDF léger (WeasyPrint, motif orange en fond, cartes sombres, ≈ 48 Ko),
téléchargement direct, « Rapports générés » et « Journal d'activité » retirés,
ouverture sur le dernier projet actif **ayant des tâches** (`src/pages/chantiers/Accueil.tsx`).

### 2. Campagnes (BDM) — refait dans le hub
- Les 52 écrans React de BDM copiés tels quels dans `src/campagnes/`
  (Pages, Components, Layouts). Imports `@/` → alias `@campagnes/`.
- Pont Inertia maison : `src/campagnes/inertia/index.jsx` (Head, Link, router,
  useForm, usePage) + `noyau.js` (requêtes Inertia JSON, Ziggy via
  `/campagnes/ziggy.json`, axios configuré, referrer pour les redirections
  « back », jetons de visite contre les courses). Hôte :
  `src/campagnes/HoteCampagnes.jsx`, route `#/campagnes/*` (adresse du hub =
  adresse du service, une à une).
- Thème du hub (motif orange, barre latérale du hub, cartes sombres) par
  surcouche CSS `src/campagnes/campagnes.css` (+ @tailwindcss/forms scopé).
- Backend `backend/campagnes` synchronisé avec BDM prod (délai contrat 10 j,
  signature avant démarrage, agence du commercial) en gardant Postgres et le hub.
- Endpoint `ziggy.json` (core/views.py `table_routes`).
- **Commerciaux externes** (`src/lib/auth/commercialExterne.ts`) : compte dont la
  seule habilitation est `campagnes` avec rôle commercial → ne voit jamais le hub
  (RequireAuth le renvoie sur /campagnes, pas de « ← GDA Hub », marque
  « Campagnes GDA »). Connexion **uniquement par le hub** (pas d'écran propre).
- `core/hub.py` : la session Campagnes suit le compte du hub (empreinte du
  jeton) et exige l'habilitation `campagnes`.
- Données fictives BDM : 4 agences, 4 types de cartes, 6 commerciaux
  (tél. 70000001…70000006, mdp BDM `Demo-2026!`), « Campagne Rentrée BDM 2026 »
  (01/09 → 30/11), 54 ventes. Comptes hub de test :
  - `commercial.bdm@gdamali.net` / `1234` → Commercial TEST (6 ventes, contrat
    en attente, 1 notification « Contrat à signer ») ;
  - `70000002` / `1234` → Aminata DIARRA (17 ventes, contrat accepté).
- NB : `commercial.test@gdamali.net` (compte Jus d'orange) a eu son mot de passe
  remis à `1234` par erreur.

### 3. Sécurité — fait
- **Suite de tests boîte noire** : `python scripts/tests/verifier_securite.py`
  (crée puis supprime ses comptes et fichiers témoins). Dernier résultat :
  **82/82** (à relancer après les derniers changements).
- Passerelle `gateway/nginx.conf` : `server_tokens off` ; en-têtes de sécurité
  (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS si
  https) ; `/admin/` et `/static/` d'identity fermés ; connexions locales fermées
  (`/api/auth/connexion|refresh|verifier|mot-de-passe/`, `/api/jus/auth/login/`,
  POST `/campagnes/login`, forgot/reset/confirm-password) ; limite de tentatives
  de connexion (limit_req par adresse réelle X-Forwarded-For) ; fichiers
  `/media/*` et `/campagnes/storage/` protégés par `auth_request` vers identity
  (`/api/identity/auth/verifier-fichier`, `comptes/vues_fichiers.py`) ;
  X-Forwarded-Proto d'origine conservé ; résolution DNS dynamique des upstreams
  (plus de 502 après recréation des conteneurs) ; route interne
  `/api/identity/interne/` fermée.
- FinanceRH et Jus d'orange : habilitation du hub exigée (`accounts/hub.py`,
  `HABILITATIONS_ADMISES`) ; jetons et sessions locaux coupés quand
  `GDAHUB_AUTH_SEULE=True` (mis dans les deux compose).
- Campagnes : pièces d'identité enregistrées sous un nom aléatoire (uuid).
- CSP stricte sur l'interface de production (`vite.config.ts`,
  `preview.headers`), vérifiée : aucune violation.
- `docker-compose.prod.yml` : `DJANGO_DEBUG: "False"` (était "True" !),
  `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, `GDAHUB_CLE_INTERNE` **obligatoires**
  (`${VAR:?…}`), `DJANGO_SSL_REDIRECT: "False"`.
- **La prod actuelle n'a PAS de `.env`** (clé Django par défaut, bases en
  `gdahub-local`). Avant le prochain déploiement, sur le serveur :
  `sh infra/securiser-production.sh` (génère les secrets, fait ALTER USER sur
  les 6 bases, écrit `.env`). Modèle : `.env.production.example`. **Ne pas le
  lancer sans l'accord de l'utilisateur.**
- Tests unitaires : financerh `accounts core` 79 OK (+3 dans
  `core/tests_notifications.py`), jusorange 75 OK, identity `comptes` 12 OK.

### 4. Notifications — fait (backend + interface)
- identity : modèles `Notification`, `AbonnementPush` (migration 0006),
  `comptes/notifications.py` (envoi + Web Push VAPID, clé dans `/cles`),
  `comptes/vues_notifications.py` : `GET notifications`,
  `POST notifications/<id>/lue`, `POST notifications/tout-lire`,
  `GET notifications/push/cle`, `POST notifications/push/abonnement|desabonnement`,
  et route interne `POST interne/notifications` (en-tête `X-Cle-Interne`).
- Déclencheurs : habilitation accordée (identity) ; demande RH approuvée ou
  rejetée (`financerh/core/workflow.py::_prevenir_demandeur`) ; contrat Campagnes
  publié, republié ou nouveau signataire
  (`campagnes/campagnes/views.py::_prevenir_signataires`). Clients d'envoi :
  `financerh/accounts/notifications_hub.py`, `campagnes/core/notifications_hub.py`.
- Interface : `src/lib/notifications/NotificationsContext.tsx` (sondage 60 s,
  abonnement push), `src/components/notifications/ClocheNotifications.tsx`
  (cloche dans la TopBar du hub et les en-têtes RH, Jus, Planning, Chantiers,
  Campagnes), page `#/notifications`.

### 5. Mobile / responsive — en grande partie fait
- `src/components/TiroirMobile.tsx` (tiroir + bouton menu) appliqué à la
  coquille du hub (`App.tsx`), RH, Jus d'orange, Planning.
- `TopBar.tsx` réécrite : l'ancienne était une maquette (« Membre Pro »,
  « Portfolio », avatar « Hamadoun Cissé » en dur pour tout le monde).
- `Sidebar.tsx` : recherche factice et « Mode clair » retirés, « Administration »
  réservé aux admins du hub, compteur de notifications réel, bouton « Installer ».
- Aucun débordement horizontal mesuré à 390 px sur les 8 écrans principaux.

### 6. PWA — fait
`public/manifest.webmanifest`, icônes `public/icons/*` (motif orange + « GDA »),
`public/sw.js` (cache de la coquille et de /assets, page hors ligne
`public/hors-ligne.html`, réception push, clic → bonne page ; jamais de cache sur
/api, /campagnes, /media), enregistrement dans `src/main.tsx`, balises dans
`index.html`, `src/components/BoutonInstaller.tsx` (Android/ordinateur + aide
iPhone). Vérifié sur le build de prod : SW actif, manifeste valide, hors ligne OK.

### 7. Performance et robustesse
Routes chargées à la demande (`React.lazy` dans `src/main.tsx`) : bundle
principal 958 Ko → 306 Ko. `src/components/FiletErreur.tsx` (error boundary)
autour des routes.

## Ce qui reste à faire (mis à jour après la reprise du 30/09)

Fait depuis la pause : crash Campagnes corrigé et vérifié ; filet anti-page
blanche en place ; « RH renvoie à l'accueil » n'était qu'une course dans le
script de test (RH et son tiroir fonctionnent sur mobile) ; grilles fixes à
4 colonnes passées en `grid-cols-2 lg:grid-cols-4` (Jus d'orange, vue
globale, rapports) ; recette sécurité **82/82** ; tests unitaires identity 12,
FinanceRH 82, Jus d'orange 75 : OK ; compte `recette.mobile@test.local` et ses
comptes locaux **supprimés** ; README mis à jour (sections 3, 5 à 9).

Enregistré dans git : branche **`hub-securite-pwa-campagnes`**, commit `e106ec5`,
poussée sur GitHub (origin). **`main` n'est pas modifiée, rien n'est déployé.**
Exclus du dépôt par `.gitignore` : `*.sql`, `BDM/`, `Bdm-main/`, `DailyGda-main/`,
`Planning-main/`, `.claude/`. `testhub/` laissé non suivi (antérieur, statut à décider).
Pour la mise en prod (sur demande seulement) : fusionner la branche dans `main`,
puis sur le VPS `sh infra/securiser-production.sh` avant `up -d --build`.

**Données réelles chargées en local (30/09)** : Chantiers (export prod du 30/09),
Campagnes/BDM (dump du 24/09 : 81 utilisateurs, 2 444 ventes, 2 185 enrôlements),
Planning (déjà présent), RH et Jus d'orange (sauvegardes prod d'août, déjà présentes).
Comptes du hub synchronisés : **tous les mots de passe locaux = `1234`**. Liste
complète, classée par application et type d'utilisateur :
`DonneeEnProd/Comptes_GDA_Hub.xlsx` (données personnelles, jamais versionné).
Procédure réutilisable : `scripts/reprise/LISEZMOI.md` (en prod, NE PAS mettre
MOT_DE_PASSE_UNIQUE). Les photos Chantiers et rapports Planning ne sont que des
chemins : copier les fichiers depuis l'ancien hébergement.

Reste :
1. Tester en vrai les notifications push sur un téléphone (HTTPS de la prod).
2. Capture mobile de Chantiers une fois la machine moins chargée (son en-tête
   a son propre bouton ☰ et la cloche ; le module met longtemps à charger en dev).
3. Optionnel : charger les vraies données BDM (dumps dans `BDM/`, données
   personnelles — ne jamais les committer).
4. Seulement à la demande de l'utilisateur : commit, push GitHub, déploiement
   (d'abord `infra/securiser-production.sh` sur le VPS).

## Fichiers clés modifiés ou créés

- Infra : `gateway/nginx.conf`, `gateway/entetes-proxy.conf`,
  `docker-compose.yml`, `docker-compose.prod.yml`, `infra/securiser-production.sh`,
  `.env.production.example`, `vite.config.ts`, `tailwind.config.js`, `index.html`,
  `public/{sw.js,manifest.webmanifest,hors-ligne.html,icons/}`.
- Interface : `src/main.tsx`, `src/App.tsx`,
  `src/components/{TopBar,Sidebar,TiroirMobile,BoutonInstaller,FiletErreur,RequireAuth}.tsx`,
  `src/components/notifications/ClocheNotifications.tsx`, `src/pages/Notifications.tsx`,
  `src/lib/{api/notifications.ts,notifications/NotificationsContext.tsx,auth/commercialExterne.ts,api/campagnesClient.ts}`,
  `src/layouts/{RhLayout,JusLayout,PlanningLayout}.tsx`, `src/campagnes/**`.
- identity : `comptes/{models.py,notifications.py,vues_notifications.py,vues_fichiers.py,urls.py,views.py,tests_notifications.py,migrations/0006_notifications.py}`,
  `config/settings.py`, `requirements.txt`.
- financerh : `accounts/{hub.py,notifications_hub.py,tests_hub.py}`,
  `core/{workflow.py,tests_notifications.py}`, `config/settings.py`.
- jusorange : `accounts/hub.py`, `JusOrange/settings.py`.
- campagnes : `core/{hub.py,views.py,urls.py,middleware.py,notifications_hub.py}`,
  `campagnes/views.py`, `terrain/views.py` (+ synchronisation BDM).
- Tests : `scripts/tests/verifier_securite.py`.
- Supprimés : `src/pages/campagnes/*`, `src/layouts/CampagnesLayout.tsx`,
  `src/lib/api/campagnes.ts`, `src/pages/chantiers/Journal.tsx`,
  `src/pages/ConnexionCampagnes.tsx`.

---

# Ancien contexte : démarrage sans Docker

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
