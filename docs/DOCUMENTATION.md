# GDA Hub — documentation du projet

Référence technique et d'exploitation de GDA Hub, l'ERP du groupe GDA
(<https://hub.gdamali.net>). Elle s'adresse à la personne qui reprend,
maintient ou déploie le projet.

- Démarrage rapide : [README.md](../README.md)
- Sécurité, tests d'intrusion et correctifs : [RAPPORT_SECURITE.md](RAPPORT_SECURITE.md)
- Reprise des comptes et des données : [scripts/reprise/LISEZMOI.md](../scripts/reprise/LISEZMOI.md)

> Aucun secret ni mot de passe ne figure dans ce document ni dans le dépôt.
> Les secrets de production vivent uniquement dans `/opt/hubdash/.env` sur le
> serveur.

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture](#2-architecture)
3. [Connexion, comptes et habilitations](#3-connexion-comptes-et-habilitations)
4. [Rôles par application](#4-rôles-par-application)
5. [Les applications](#5-les-applications)
6. [Circuit de validation RH & Finance](#6-circuit-de-validation-rh--finance)
7. [Interface (frontend)](#7-interface-frontend)
8. [Notifications](#8-notifications)
9. [Mobile et PWA](#9-mobile-et-pwa)
10. [Développement local](#10-développement-local)
11. [Production et déploiement](#11-production-et-déploiement)
12. [Administration courante](#12-administration-courante)
    - [Sauvegardes et restauration](#sauvegardes-et-restauration)
13. [Tests](#13-tests)
14. [Sécurité](#14-sécurité)
15. [Dépannage](#15-dépannage)
16. [Points ouverts](#16-points-ouverts)

---

## 1. Vue d'ensemble

GDA Hub rassemble sous **une seule adresse et un seul compte** les
applications métier du groupe, auparavant séparées :

| Application | Origine | Pour qui |
|---|---|---|
| **RH & Finance** | ex-app rhfinance | tous les employés : congés, permissions, retards, présences, demandes financières, validations |
| **Jus d'orange** | ex-app JusOrange | récolte, production, stock, ventes, trésorerie, reporting |
| **Chantiers** | ex-DailyGda (daily.gdamali.net) | suivi de chantier : phases, tâches, saisie du jour, photos, rapport PDF |
| **Planning** | ex-Planning (média) | calendrier des tournages et publications par client |
| **Campagnes** | ex-BDM | campagnes de cartes bancaires (BDM, UBA) : contrats, ventes, enrôlements, commerciaux externes |

Principes :

- **Une seule connexion** : seul le hub authentifie. Les anciens écrans de
  connexion des applications sont fermés.
- **Un compte, des habilitations** : chaque personne a un compte hub, et une
  habilitation (avec un ou plusieurs rôles) par application ouverte.
- **Les comptes externes ne voient pas le hub** : commerciaux Campagnes,
  partenaire de chantier (B2Gold), clients Planning arrivent directement dans
  leur application.

---

## 2. Architecture

```
                     navigateur (PC, mobile, appli installée)
                                    │ https
                     nginx de l'hôte (TLS, hub.gdamali.net)
                                    │
                    ┌───────── gateway (nginx, conteneur) ─────────┐
                    │ /            → frontend (interface compilée) │
                    │ /api/identity → identity                     │
                    │ /api/rh, /api/finance, /api/utilisateurs …   │
                    │              → financerh                     │
                    │ /api/jus      → jusorange                    │
                    │ /api/chantiers→ chantiers                    │
                    │ /api/planning → planning                     │
                    │ /campagnes/   → campagnes (Django + Inertia) │
                    │ /media/*      → fichiers, après auth_request │
                    └──────────────────────────────────────────────┘
                     une base PostgreSQL par service (6 bases)
```

### Services

| Service | Rôle | Pile | Base |
|---|---|---|---|
| `gateway` | unique porte d'entrée, routage, en-têtes de sécurité, limite de tentatives, contrôle des fichiers | nginx 1.29 | — |
| `frontend` | l'interface unique | React 18 + Vite + Tailwind, TypeScript | — |
| `identity` | comptes, habilitations, jetons RS256 (JWKS), notifications, Web Push | Django 6 + DRF | PostgreSQL 17 |
| `financerh` | RH (absences, présences, évaluations…) et Finance (réquisitions, dépenses, missions, caisses…) | Django 6 + DRF | PostgreSQL 17 |
| `jusorange` | Jus d'orange | Django 5.2 LTS + DRF | PostgreSQL 16 |
| `chantiers` | Chantiers | Django 5.2 LTS + DRF | PostgreSQL 17 |
| `planning` | Planning | Django 5.2 LTS + DRF | PostgreSQL 17 |
| `campagnes` | Campagnes (BDM) | Django + Inertia | PostgreSQL 17 |

En local, chaque service est aussi joignable sur son port (débogage) :
gateway `8080`, frontend `3010`, identity `8101`, financerh `8110`,
jusorange `8120`, campagnes `8130`, chantiers `8140`, planning `8150` ;
bases `5441`→`5447`. En production, seul `127.0.0.1:8080` est publié, derrière
le nginx de l'hôte.

### Arborescence

```
.
├─ src/                          interface React (voir § 7)
│  ├─ lib/api/*.ts               contrat avec chaque service (chemins, formes de réponse)
│  ├─ layouts/                   coquilles des applis (RhLayout, JusLayout, PlanningLayout, CoquilleChantiers)
│  ├─ components/                composants partagés (NavigationApps, BarreOngletsMobile, Avatar…)
│  ├─ pages/                     écrans par application
│  └─ campagnes/                 écrans BDM repris tels quels + pont Inertia
├─ backend/
│  ├─ identity/  financerh/  jusorange/  chantiers/  planning/  campagnes/
├─ libs/gdahub_common/           socle commun des services Django (réglages, auth hub, erreurs)
├─ gateway/                      nginx.conf, entetes-proxy.conf, fichiers-securite.conf
├─ infra/                        securiser-production.sh, reprise de données, nginx de l'hôte
├─ scripts/
│  ├─ tests/                     verifier_securite.py, pentest_acces.py, matrice_roles.py
│  └─ reprise/                   synchronisation des comptes, classeur Excel
├─ public/                       manifeste PWA, icônes, service worker, page hors ligne
├─ docker-compose.yml            pile de développement
└─ docker-compose.prod.yml       pile de production (VPS)
```

**Règle** : `src/lib/api/*.ts` est le contrat entre l'interface et les
services. Toute évolution d'un endpoint Django doit rester conforme à ces
fichiers (chemins, méthodes, formes de réponse), ou les mettre à jour dans le
même commit.

---

## 3. Connexion, comptes et habilitations

### Le parcours d'une connexion

1. L'utilisateur saisit son identifiant et son mot de passe sur l'écran du hub
   (`POST /api/identity/auth/connexion`).
2. `identity` vérifie, puis remet :
   - un **jeton d'accès** RS256 de 15 minutes, aussi posé en cookie
     `gdahub_acces` (HttpOnly) ;
   - un **jeton de rafraîchissement**, lié à une session révocable.
3. Chaque service vérifie la signature via la clé publique
   (`/.well-known/jwks.json`) et exige **l'habilitation** de son application
   dans le jeton (`backend/<service>/**/hub.py`). La passerelle transforme le
   cookie en en-tête `Authorization` pour les écrans servis directement.
4. Au rafraîchissement, les habilitations sont relues en base : un accès
   retiré cesse au plus tard 15 minutes après.

`identity` est le seul service qui connaît les mots de passe et la clé privée.

### Identifiants acceptés

- l'adresse complète : `hcisse@gdamali.net` ;
- **le nom court**, sans le domaine : `hcisse`, `modi.kone`, `sira.diallo`.
  Le domaine est complété avec la liste `GDAHUB_DOMAINES_MAIL` (par défaut
  `gdamali.net,decheznousmali.com`). Si le nom correspond à deux comptes, rien
  n'est ouvert : il faut taper l'adresse complète ;
- un numéro de téléphone (commerciaux Campagnes).

Un identifiant exact l'emporte toujours sur le nom court.

### Mot de passe provisoire

Un compte peut être marqué `doit_changer_mot_de_passe` : à la connexion, le
hub propose d'en choisir un personnel (écran `ChangementObligatoire`). La
personne peut reporter (« Plus tard », valable le temps de la session) et le
faire ensuite dans **Mon compte**. Le changement lève l'indicateur et ferme
toutes les sessions du compte.

### Lien avec les comptes des applications

Une habilitation porte un `identifiant_local` qui désigne le compte de la
personne dans l'application, quand celle-ci en a un :

| Appli | Compte local | Rapprochement |
|---|---|---|
| RH & Finance | `accounts_utilisateur` | e-mail |
| Jus d'orange | `auth_user` + groupes | `identifiant_local` (ex. `direction`, `finance`, `resprod`), sinon e-mail |
| Campagnes | `users` | `identifiant_local` explicite (nom ou téléphone), sinon e-mail |
| Chantiers, Planning | aucun (principal construit depuis le jeton) | — ; client Planning : `identifiant_local` = id du client |

Un jeton valide qui ne correspond à aucun compte d'une application est refusé,
jamais transformé en compte neuf.

### Comptes externes

Gérés par `src/lib/auth/commercialExterne.ts` (`espaceExterne`) :

| Profil | Seule habilitation | Arrive sur |
|---|---|---|
| commercial BDM/UBA | `campagnes` : `commercial` / `commercial_telephonique` | `/campagnes` |
| partenaire de chantier (B2Gold) | `daily` : `partenaire` | `/chantiers` (ses chantiers, lecture seule) |
| client Planning | `planning` : `client` | `/planning` (son calendrier) |

Ils ne voient ni l'accueil, ni les autres applis, ni le bouton « Retour au
hub ». Un partenaire voit un chantier quand son id hub figure dans
`chantiers_project.user_ids`.

---

## 4. Rôles par application

Codes d'application et rôles portés par les habilitations (`identity`) :

| Code | Appli | Rôles et effet |
|---|---|---|
| `hub` | administration du hub | `admin` : écran **Administration** (comptes, habilitations, départements, journal) |
| `rh` | RH | `agent` (salarié), `gestionnaire` (back-office RH), `direction` |
| `finance` | Finance | `agent`, `gestionnaire` (back-office Finance, valide), `direction` |
| `direction` | Direction générale | `admin`, `membre` |
| `orange` | Jus d'orange | `admin` (tout), `direction` (lit tout, gère les comptes Jus), `finance` (trésorerie, lit le reste), `commercial`, `responsable_production` |
| `daily` | Chantiers | `admin`, `chef_chantier`, `ingenieur`, `controle_qualite` (équipe, écriture) ; `direction` (tous les chantiers, lecture seule) ; `partenaire` (ses chantiers, lecture seule) |
| `planning` | Planning | `admin` (écriture), `team` (lecture), `client` (son espace) |
| `campagnes` | Campagnes | `admin`, `direction` (consultation), `commercial`, `commercial_telephonique` |

Dans RH & Finance, le **rôle métier** (`SALARIE`, `RH`, `FINANCE`,
`DIRECTION`) est porté par le compte local (`accounts_utilisateur.role`) et
filtre les données (périmètre : soi, son équipe si manager, tout pour le
back-office du domaine). Un responsable de département valide les demandes de
son équipe.

Le super-administrateur (`is_superuser`) a tous les accès.

---

## 5. Les applications

### RH & Finance (`backend/financerh`)

- **RH** : demandes d'absence (congés, permissions, retards), soldes de
  congés, présences, évaluations, formations, annuaire, organisation.
- **Finance** : réquisitions (avec lignes), demandes de prix, offres, bons de
  commande, dépenses, missions (frais), sorties de caisse, caisses, forfaits de
  communication, seuils de validation.
- Toutes les demandes passent par le **circuit de validation** (§ 6).

### Jus d'orange (`backend/jusorange`)

Producteurs, cueillettes, réceptions, productions, conditionnements,
bouteilles, inventaires, articles et stock (seuils d'alerte), prospection,
clients, commandes, ventes, factures, paiements, trésorerie, reporting par
module (récolte, appro, fabrication, emballage, entrepôt, distribution) avec
export Excel. Droits par section : `api/permissions.py` (miroir côté
interface : `src/lib/rolesJus.ts`).

### Chantiers (`backend/chantiers`)

Projets → phases → sous-phases → tâches ; saisie du jour (avancement,
justification), photos (contrôle de format), météo, tableau de bord,
rapport PDF (FR/EN). Interface dans la coquille du hub
(`src/layouts/CoquilleChantiers.tsx`) : choix du chantier actif et langue du
rapport dans l'en-tête.

### Planning (`backend/planning`)

Clients, idées de contenu, tournages, publications (statuts, reprogrammation),
règles de publication, calendrier, statistiques, rapports PDF. Un client ne
voit que sa fiche et son calendrier.

### Campagnes (`backend/campagnes`)

Campagnes de vente de cartes et d'enrôlement (BDM, UBA), agences, commerciaux,
contrats de prestation (acceptation ou refus **jusqu'à la date de fin de la
campagne**), ventes, enrôlements, reporting téléphonique, rapports et
performances, exports. Les écrans React de BDM sont repris dans
`src/campagnes/` et servis à `#/campagnes/*` par un pont Inertia
(`src/campagnes/inertia/`), avec `route()` lu depuis `/campagnes/ziggy.json`.
Un admin choisit le client (BDM, UBA) à l'entrée ; un commercial reste dans le
périmètre de son compte.

---

## 6. Circuit de validation RH & Finance

Socle commun à toutes les demandes : `backend/financerh/core/` (`workflow.py`,
`mixins.py`, `echanges.py`).

### Étapes

À la soumission, un circuit d'étapes est construit d'après les **seuils de
validation** (type de document, montant) : responsable hiérarchique, back-office,
direction… Chaque étape est de nature `DECISION` (un refus arrête), `AVIS`
(un refus est transmis) ou `INFORMATION`. Les étapes s'ouvrent en parallèle ;
le dossier se clôt quand l'étape décisive tranche. Nul ne valide son propre
dossier.

### Détail, mise en attente, échanges, versions

Chaque dossier a une **page de détail** (`#/rh/dossiers/<type>/<id>`, types :
`absence`, `requisition`, `depense`, `mission`, `sortie-caisse`,
`bon-commande`, `prestation`) :

- **Approuver**, **Mettre en attente** (observation obligatoire, envoyée au
  demandeur) ou **Refuser** (motif obligatoire).
- La mise en attente ne tranche rien. La **réponse** du demandeur dans le fil,
  ou la **correction** de sa demande, relance le dossier vers ses valideurs ;
  un valideur peut aussi le reprendre.
- **Fil d'échange** entre demandeur et valideurs, avec les faits marquants
  (soumission, attente, reprise, décisions).
- **Versions** : chaque soumission et chaque correction crée une version ;
  l'onglet Versions montre les champs modifiés (avant → après).

Tout est consigné dans `EvenementDossier` (journal en lecture seule, piste
d'audit). Routes, pour chaque type de document :

| Action | Route |
|---|---|
| détail complet | `GET  …/<id>/dossier/` |
| message | `POST …/<id>/echanger/` `{texte}` |
| mise en attente | `POST …/<id>/mettre-en-attente/` `{motif}` |
| reprise | `POST …/<id>/reprendre/` |
| décision | `POST …/<id>/valider/`, `…/<id>/rejeter/` `{commentaire}` |

Accès au détail : le demandeur, les valideurs de son circuit, la Direction,
et le périmètre habituel de la vue.

---

## 7. Interface (frontend)

- **Routage** : `HashRouter` (`#/…`), écrans chargés à la demande
  (`React.lazy`) dans `src/main.tsx`.
- **Session** : `src/lib/auth/AuthContext.tsx` (identité, habilitations,
  applications, relues à chaque ouverture). `RequireAuth` redirige les comptes
  externes et propose le changement de mot de passe provisoire.
- **Navigation** : `src/components/NavigationApps.tsx`, à la manière de la
  documentation Angular. Chaque appli est une section dépliable avec ses
  sous-menus filtrés par rôle ; on passe d'une appli à l'autre sans repasser
  par l'accueil. Bouton **Retour au hub** en tête de barre latérale.
- **Coquilles** : même barre latérale et même en-tête pour le hub
  (`Sidebar`), RH (`RhLayout`), Jus (`JusLayout`), Planning (`PlanningLayout`),
  Chantiers (`CoquilleChantiers`) ; Campagnes garde sa barre (`src/campagnes/
  Components/Sidebar.jsx`) avec « Autres applications ».
- **Accueil** (`src/pages/Accueil.tsx`) : tableau de bord alimenté par les
  urgences de toutes les applis de la personne (`src/lib/urgences.ts`) :
  dossiers à valider, compléments demandés, stock Jus sous le seuil,
  chantiers en retard, publications et tournages en retard.
- **Avatars** : `src/components/ui/Avatar.tsx` affiche la photo de profil si
  elle existe (`/api/identity/auth/photos`, `src/lib/photos.ts`), sinon les
  initiales.
- **Design** : thème sombre translucide sur motif orange, Tailwind
  (`tailwind.config.js`, couleurs `surface`, `accent`…). Les écrans Chantiers
  gardent leurs composants (`src/styles/gda-daily*.css`, sous `.gda-daily`).

---

## 8. Notifications

- Stockées dans `identity` (`Notification`), affichées par la cloche et la
  page `#/notifications`, envoyées aux appareils abonnés en **Web Push**
  (clés VAPID dans le volume `cles`, endpoints limités aux services push
  officiels).
- Une application notifie par la route interne
  `POST http://identity:8000/api/identity/interne/notifications` avec l'en-tête
  `X-Cle-Interne` (`GDAHUB_CLE_INTERNE`), jamais exposée par la passerelle.
  Clients : `backend/financerh/accounts/notifications_hub.py`,
  `backend/campagnes/core/notifications_hub.py`.
- Déclencheurs : habilitation accordée, demande approuvée ou rejetée, dossier
  mis en attente ou repris, message dans un dossier, dossier modifié, contrat
  Campagnes publié ou republié.

---

## 9. Mobile et PWA

- **Installable** : `public/manifest.webmanifest` (raccourcis par appui long :
  congés, à valider, notifications, compte), icônes `public/icons/`.
- **Service worker** `public/sw.js` : coquille et fichiers compilés en cache,
  page `hors-ligne.html` ; jamais de cache sur `/api/`, `/campagnes/`,
  `/media/` ; aucun cache sur `localhost`. Une nouvelle version **attend le
  clic** « Mettre à jour » (`src/components/EtatApplication.tsx`, contrôle
  horaire) ; bandeaux « Hors connexion » / « Connexion rétablie ».
- **Téléphone et tablette** : barre d'onglets du bas
  (`BarreOngletsMobile.tsx` : Accueil, Congés ou À valider, Alertes, Compte,
  Plus), tableaux affichés en cartes sous 768 px (`LibellesTableaux.tsx` +
  `src/index.css`), champs à 16 px (pas de zoom iPhone), zones sûres
  (encoche, barre du bas).
- **iPhone** : barre d'état opaque ; une appli installée avant ce réglage doit
  être réinstallée pour en profiter.
- Audit responsive : script Playwright (390 et 768 px, tous les rôles) — zéro
  débordement au dernier passage.

---

## 10. Développement local

Prérequis : Docker Desktop ; Node 22 pour travailler l'interface hors Docker ;
Python 3.12+ pour les scripts.

```bash
cp .env.example .env
docker compose up -d --build        # pile complète, http://localhost:8080
docker compose logs -f identity     # journaux d'un service
docker compose down                 # arrêt (les données restent)
```

En développement, le code est monté dans les conteneurs (`runserver`,
`vite dev`) : une modification est prise en compte sans reconstruire.

Commandes utiles :

```bash
docker exec gdahub-<service> python manage.py migrate
docker exec gdahub-<service> python manage.py makemigrations --check --dry-run
npx tsc -b                          # typage de l'interface
npm run build                       # build de production de l'interface
```

Données réelles en local : voir `scripts/reprise/LISEZMOI.md` et les
commandes `importer_bdm` (Campagnes), `importer_daily` (Chantiers),
`synchroniser_comptes.py`. Les exports SQL et classeurs de comptes restent
dans `DonneeEnProd/` (ignoré par Git, ne jamais versionner).

---

## 11. Production et déploiement

- **Serveur** : VPS, dépôt dans `/opt/hubdash`, pile
  `docker-compose.prod.yml`, publiée sur `127.0.0.1:8080` derrière le nginx de
  l'hôte (TLS, `hub.gdamali.net`).
- **Secrets** (`/opt/hubdash/.env`, jamais versionné) : `DJANGO_SECRET_KEY`,
  `POSTGRES_PASSWORD`, `GDAHUB_CLE_INTERNE`, `GDAHUB_ADMIN_MOT_DE_PASSE`. La
  pile refuse de démarrer sans eux ; chaque service refuse aussi une clé de
  développement quand `DJANGO_DEBUG=False`. Première installation :
  `sh infra/securiser-production.sh` (génère les secrets, change le mot de
  passe des six bases, écrit `.env`).
- **Interface** : image compilée (`target: production`, `vite build` +
  `vite preview` avec CSP). Elle contient seulement le frontend
  (`Dockerfile.dockerignore`) : ni backend, ni `.env`, ni sauvegardes.
- **identity** en production : pas d'import de comptes de démonstration ; le
  compte admin initial n'est créé que sur une base vide.

### Procédure de déploiement

```bash
# sur le serveur
cd /opt/hubdash
D=sauvegardes/$(date +%Y%m%d_%H%M); mkdir -p $D
docker exec gdahub-db-<service> sh -c 'pg_dumpall -U $POSTGRES_USER' | gzip > $D/<service>.sql.gz
git pull --ff-only origin main
docker exec gdahub-<service> python manage.py migrate --noinput      # si migrations
docker compose -f docker-compose.prod.yml restart <service>           # services Django
docker compose -f docker-compose.prod.yml build frontend && \
docker compose -f docker-compose.prod.yml up -d frontend              # interface
```

Toujours sauvegarder la ou les bases concernées avant une migration ou une
modification de données. Les sauvegardes sont rangées dans
`/opt/hubdash/sauvegardes/` (ignoré par Git).

### Restaurer une base

```bash
gunzip -c sauvegardes/<date>/<service>.sql.gz | \
  docker exec -i gdahub-db-<service> sh -c 'psql -U $POSTGRES_USER -d postgres'
```

---

## 12. Administration courante

### Donner ou retirer un accès

Écran **Administration** du hub (rôle `hub:admin`) : compte → habilitations →
application, rôle(s), identifiant local si l'appli en a un (Jus,
Campagnes, client Planning). Effet à la prochaine connexion, ou au plus tard
15 minutes après.

### Créer un compte

Administration → Nouveau compte. Identifiant = adresse GDA de préférence (la
connexion par nom court suit). Pour RH & Finance, la personne doit aussi
exister dans `accounts_utilisateur` (rôle métier, manager, département).

### Mots de passe

- La personne change le sien dans **Mon compte**.
- Remettre un mot de passe provisoire commun, avec changement proposé à la
  connexion :

  ```bash
  docker exec gdahub-identity python manage.py reinitialiser_mots_de_passe --mot-de-passe '<provisoire>'
  # --tous pour inclure les comptes inactifs ; ferme toutes les sessions
  ```

### Rattacher un partenaire à un chantier

Pas encore d'écran : ajouter l'id hub du partenaire dans `user_ids` (et son
nom dans `user_names`) du projet, table `chantiers_project`.

### Désactiver un départ

Administration → compte → inactif. Penser à désactiver aussi le compte local
de l'application quand il existe (Campagnes : `users.actif`).

---

### Sauvegardes et restauration

**Automatique, chaque nuit à 2 h 30** (`/etc/cron.d/gdahub-sauvegarde` →
`infra/sauvegarde.sh`, journal `/var/log/gdahub-sauvegarde.log`). Dossier
`/var/backups/gdahub/AAAA-MM-JJ_HHMM/`, accessible au seul root :

| Contenu | Détail |
|---|---|
| `bases/<service>.sql.gz` | les 6 bases PostgreSQL, vérifiées après export |
| `fichiers/<volume>/` | justificatifs, photos, pièces d'identité ; instantanés rsync incrémentaux (un fichier inchangé n'occupe de la place qu'une fois) |
| `secrets/` | `.env` et clés de signature des jetons |
| `MANIFESTE.txt` | tailles, empreintes SHA-256, version du code, erreurs |

- **Conservation** : 7 jours, puis le dimanche pendant 4 semaines, puis le 1er
  du mois pendant 6 mois.
- **Échec** : les super-administrateurs reçoivent une notification du hub.
- **Lancer à la main** : `sudo /opt/hubdash/infra/sauvegarde.sh`.

**Restaurer une base** :

```bash
# Essai sans risque (base temporaire, supprimée ensuite)
sudo /opt/hubdash/infra/restaurer.sh /var/backups/gdahub/<date> financerh --essai
# Remplacement réel (l'état actuel est sauvegardé juste avant)
sudo /opt/hubdash/infra/restaurer.sh /var/backups/gdahub/<date> financerh
```

**Restaurer des fichiers** : recopier `fichiers/<volume>/` vers
`/var/lib/docker/volumes/gdahub_<volume>/_data/` (`rsync -a`).

**Limite actuelle** : les sauvegardes restent sur le même serveur. Une copie
chiffrée hors du serveur (Backblaze B2, stockage objet Contabo…) reste à mettre
en place.

---

## 13. Tests

| Suite | Commande | Contenu |
|---|---|---|
| identity | `docker exec gdahub-identity python manage.py test comptes` | connexion (nom court, domaines), mot de passe provisoire, photos, notifications, fichiers |
| RH & Finance | `docker exec gdahub-financerh python manage.py test` | circuit, périmètres, dossiers (attente, échanges, versions), lignes Finance |
| Jus d'orange | `docker exec gdahub-jusorange python manage.py test` | droits par section, métier |
| Recette sécurité | `python scripts/tests/verifier_securite.py` | 82 contrôles boîte noire (jetons, habilitations, en-têtes, fichiers…) |
| Pentest d'accès | `python scripts/tests/pentest_acces.py` | 43 attaques (IDOR, élévation, cloisonnement, jetons forgés…) |
| Matrice des rôles | `python scripts/tests/matrice_roles.py` | ~600 contrôles : cloisonnement entre applis, écritures par rôle, écrans réservés, révocation |

Les trois scripts visent `http://localhost:8080` avec les comptes locaux.
Chantiers, Planning et Campagnes n'ont pas de tests unitaires propres : ils
sont couverts par la matrice et le pentest.

---

## 14. Sécurité

Détail et historique : [RAPPORT_SECURITE.md](RAPPORT_SECURITE.md). En bref :

- authentification unique (RS256, 15 min, sessions révocables), habilitation
  exigée par chaque service, connexions locales fermées ;
- limite de tentatives de connexion (passerelle + identity) ;
- fichiers `/media/*` servis seulement après contrôle d'habilitation
  (`auth_request`), types restreints, CSP « sandbox » ;
- en-têtes de sécurité, CSP de l'interface, traversée de répertoire bloquée ;
- envois push limités aux services officiels (anti-SSRF) ;
- périmètres de données vérifiés (RH/Finance, Chantiers, Planning, Campagnes) ;
- secrets obligatoires en production, pas de valeurs par défaut connues ;
- image de l'interface sans code serveur, sans `.env` ni sauvegardes.

---

## 15. Dépannage

| Symptôme | Cause probable | Correction |
|---|---|---|
| « Nouvelle version — Mettre à jour » | un déploiement a eu lieu | cliquer ; sinon Ctrl+F5 |
| « Un problème est survenu » sur un écran | erreur d'affichage, ou ancienne version en cache | recharger ; si persistant, regarder la console du navigateur |
| 502 sur toute l'origine | un service Django en erreur au démarrage | `docker logs gdahub-<service>` ; souvent un secret manquant dans `.env` |
| Jus : « compte non rattaché » | habilitation `orange` sans `identifiant_local` valable | renseigner l'identifiant local (Administration) |
| Campagnes : anonyme pour un admin | habilitation `campagnes` sans `identifiant_local` | renseigner le nom du compte Campagnes |
| La photo de profil n'apparaît pas | annuaire des photos rafraîchi toutes les 10 min | recharger la page |
| iPhone : en-tête sous l'heure | appli installée avec l'ancien réglage | supprimer l'icône et réinstaller |
| Connexion refusée par nom court | même nom sur deux domaines | taper l'adresse complète |

Journaux : `docker logs --tail 100 gdahub-<service>` ; tentatives de
connexion : Administration → journal des connexions.

---

## 16. Points ouverts

- Les services Django tournent encore avec `runserver` en production
  (`DJANGO_DEBUG=False`) : passer à la cible `production` (gunicorn).
- nginx de l'hôte : activer HSTS et masquer sa version.
- Mots de passe provisoires : s'assurer que chacun a choisi le sien, admins en
  premier.
- Pas d'écran pour rattacher un partenaire à un chantier.
- Liste « À valider » : absences et réquisitions seulement (les autres types
  de documents ont déjà leur page de détail).
- Accueil : Campagnes ne remonte pas encore d'urgences.
- Tests unitaires à écrire pour Chantiers, Planning et Campagnes.
