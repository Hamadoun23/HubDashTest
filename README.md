# GDA Hub — virtus-dashboard

ERP du groupe GDA : un compte, une adresse, toutes les applications métier
derrière. Ce dépôt contient **le frontend (React/Vite) et le backend
(Django, un service par application)** — la pile complète.

Stack : **React + Vite** (`src/`), **Django + DRF** (`backend/`), **PostgreSQL**
et **MySQL** (Campagnes), le tout dans Docker.

---

## 1. Démarrer

```bash
cp .env.example .env
docker compose up -d --build
```

Puis <http://localhost:8080>.

```bash
docker compose logs -f frontend   # journaux d'un service
docker compose down               # arrêt, les données restent
docker compose down -v            # arrêt ET suppression des bases
```

Le code est monté en volume : une modification est prise en compte sans
reconstruire l'image, côté Django comme côté Vite.

Sans Docker, pour travailler sur le frontend seul :

```bash
npm install
npm run dev
```

Il faudra alors un backend joignable (`VITE_API_BASE_URL` dans `.env`, par
défaut `http://localhost:8080/api` en développement local).

---

## 2. Ce qui tourne

| Service | Rôle | Base | Port |
| ------- | ---- | ---- | ---- |
| `gateway` | nginx, l'unique porte d'entrée | — | **8080** |
| `frontend` | l'interface unique (React/Vite) | — | 3010 |
| `identity` | comptes, habilitations, signature des jetons (RS256/JWKS) | PostgreSQL | 8101 |
| `financerh` | congés, présences, permissions, finance | PostgreSQL | 8110 |
| `jusorange` | production, commercial, finance, reporting | PostgreSQL | 8120 |
| `campagnes` | campagnes de cartes bancaires (ex-BDM), Django + Inertia | MySQL | 8130 |
| `chantiers` | suivi de chantier, équipes, avancement | PostgreSQL | 8140 |
| `planning` | tournages, publications, calendrier | PostgreSQL | 8150 |

Une seule adresse suffit en usage normal : `http://localhost:8080`. Les ports
par service ne servent qu'au débogage direct.

---

## 3. Le compte unique

```
navigateur ──► gateway ──► identity        (identifiant + mot de passe)
                             │
                             └─► jeton d'accès signé RS256, 15 minutes
                                   │
navigateur ──► gateway ──► rh ────┘        (vérifie la signature via JWKS)
```

- `identity` est le **seul** service qui connaît les mots de passe et signe
  les jetons. Sa clé privée ne sort jamais de son conteneur.
- **Dans le hub, la connexion et les droits passent uniquement par identity.**
  Avec `GDAHUB_AUTH_SEULE=True` (les deux compose), FinanceRH et Jus d'orange
  n'acceptent plus leurs propres jetons ni sessions ; la passerelle ferme en
  plus toutes les connexions locales (`/api/auth/connexion/`,
  `/api/jus/auth/login/`, POST `/campagnes/login`, mots de passe oubliés…).
- Chaque application exige **l'habilitation** correspondante portée par le
  jeton (`backend/<service>/**/hub.py`) : retirer un accès dans
  `/administration` suffit à le fermer, même si un compte local existe.
- Un jeton valide qui ne correspond à aucun agent d'une application est
  refusé, jamais transformé en compte neuf.
- **Commerciaux externes** (Campagnes : BDM, UBA) : un compte dont la seule
  habilitation est `campagnes` avec un rôle commercial ne voit jamais le hub —
  il arrive sur son tableau de bord Campagnes (`src/lib/auth/commercialExterne.ts`).

---

## 4. Structure du dépôt

```
virtus-dashboard/
├─ src/                        frontend React/Vite — voir src/lib/api/*.ts pour le contrat
├─ backend/
│  ├─ identity/                comptes, habilitations, jetons
│  ├─ financerh/               RH + finance
│  ├─ jusorange/                production, commercial, finance, reporting
│  ├─ campagnes/                Django + Inertia (ex-BDM)
│  ├─ campagnes-frontend/       le bundle React que Django/Inertia sert (pas consommé par src/)
│  ├─ chantiers/                suivi de chantier
│  └─ planning/                 tournages, publications
├─ libs/gdahub_common/          socle partagé par les services Django (auth, pagination, erreurs)
├─ gateway/nginx.conf           l'unique porte d'entrée
├─ infra/                       scripts de démarrage, reprise de données
└─ docker-compose.yml           la pile complète
```

`src/lib/api/*.ts` est le contrat de référence entre le frontend et chaque
service : toute modification d'un endpoint Django doit rester conforme à ce
que ces fichiers attendent (chemins, méthodes, formes de réponse).

---

## 5. Avant toute mise en service

- **Les secrets de production.** `docker-compose.prod.yml` exige
  `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD` et `GDAHUB_CLE_INTERNE` dans `.env`
  et refuse de démarrer sans eux. Sur un serveur qui tournait jusqu'ici sans
  `.env`, lancer une fois `sh infra/securiser-production.sh` avant de
  redéployer : il génère les secrets, change le mot de passe des six bases et
  écrit `.env` (modèle : `.env.production.example`).
- **`DJANGO_DEBUG` reste à `False` en production** (il était à `True`).
- **Le mot de passe du super administrateur** vaut `admin` par défaut
  (`GDAHUB_ADMIN_MOT_DE_PASSE` dans `.env`), et les comptes importés de
  l'effectif reçoivent `12345`. Ni l'un ni l'autre n'a de raison de survivre
  à la première connexion.
- **`runserver`/`vite dev` ne sont pas des serveurs de production.** Les
  `Dockerfile` portent déjà une cible `production` (gunicorn côté Django,
  `vite build` + `vite preview` côté frontend).
- **Le fichier d'effectif réel** (`infra/effectif/personnel.json`) n'est pas
  versionné. Sans lui, l'ERP s'amorce sur le jeu anonyme
  (`personnel.exemple.json`).

---

## 6. Sécurité et tests

```bash
python scripts/tests/verifier_securite.py        # recette boîte noire, contre http://localhost:8080
docker exec gdahub-identity  python manage.py test comptes
docker exec gdahub-financerh python manage.py test accounts core
docker exec gdahub-jusorange python manage.py test
```

La recette crée ses comptes et fichiers témoins puis les supprime. Elle
vérifie, pour chaque application, le refus sans jeton, avec un jeton
falsifié, avec un jeton expiré et avec un compte non habilité, puis l'accès
d'un compte habilité ; plus l'admin Django fermé, les connexions locales
fermées, les en-têtes de sécurité, les fichiers déposés protégés, la
révocation à la déconnexion et la limite de tentatives de connexion.

Ce que porte la passerelle (`gateway/nginx.conf`) : en-têtes de sécurité
(nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS en
https), version de nginx masquée, limite de tentatives sur
`/api/identity/auth/connexion`, fichiers `/media/*` et `/campagnes/storage/`
contrôlés par identity avant d'être servis (`auth_request`), résolution DNS
dynamique des conteneurs (pas de 502 après un `up -d --build`). L'interface
de production (`vite preview`) envoie une CSP stricte (`vite.config.ts`).

## 7. Notifications

- Rangées dans identity (`Notification`), lues par la cloche de chaque
  application et la page `#/notifications`, poussées sur les appareils
  abonnés (Web Push, clés VAPID dans le volume `cles`).
- Une application notifie par la route interne
  `POST http://identity:8000/api/identity/interne/notifications`, avec
  l'en-tête `X-Cle-Interne` (`GDAHUB_CLE_INTERNE`) ; la passerelle ne l'expose
  jamais. Clients prêts à l'emploi : `backend/financerh/accounts/notifications_hub.py`,
  `backend/campagnes/core/notifications_hub.py`.
- Déclencheurs actuels : accès accordé à une application, demande RH
  approuvée ou rejetée, contrat Campagnes publié ou republié.

## 8. Mobile et PWA

- Menu en tiroir sous 1024 px (`src/components/TiroirMobile.tsx`) dans le hub,
  RH, Jus d'orange et Planning ; Chantiers et Campagnes ont le leur.
- Installable : `public/manifest.webmanifest`, icônes `public/icons/`,
  service worker `public/sw.js` (coquille et fichiers compilés en cache, page
  `hors-ligne.html`, notifications push). Les données (`/api/`, `/campagnes/`,
  `/media/`) ne sont jamais mises en cache.
- Chaque écran est chargé à la demande (`React.lazy`) : le premier affichage
  ne télécharge pas le code de toutes les applications.

## 9. Campagnes dans le hub

Les écrans React de BDM sont repris tels quels dans `src/campagnes/` et
servis à `#/campagnes/*` : le pont `src/campagnes/inertia/` remplace
`@inertiajs/react` et lit le service Campagnes en JSON (protocole Inertia),
`route()` vient de `/campagnes/ziggy.json`. L'adresse du hub et celle du
service correspondent une à une (`#/campagnes/ventes` ↔ `/campagnes/ventes`).
Habillage du hub par surcouche CSS : `src/campagnes/campagnes.css`.
