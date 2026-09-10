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
- Chaque application backend accepte ce jeton **en plus** de son
  authentification propre (`backend/<service>/**/hub.py`) — le hub s'ajoute,
  il ne remplace pas. Une application continue de fonctionner seule si le hub
  tombe.
- Un jeton valide qui ne correspond à aucun agent d'une application est
  refusé, jamais transformé en compte neuf.

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
