# Documentation — Module Prospection
## Projet JusOrange GDA

---

## 1. Présentation du module

Le module **Prospection** est la cartographie commerciale : il permet aux
commerciaux d'enregistrer sur une carte chaque point de vente démarché et de
suivre l'avancement du démarchage.

- Les **Points de vente** : lieux physiques géolocalisés (boutique, supermarché,
  restaurant, entreprise, grossiste…) avec leur contact sur place, leur statut,
  leur potentiel commercial et leur date de prochaine relance.
- Les **Visites** : passages datés d'un commercial sur un point, avec compte
  rendu, photo et statut constaté.

**Important — les points de vente ne sont pas des clients.** Un client
particulier achète du jus sans être un point de vente : il vit uniquement dans
`distribution.Client` et n'apparaît jamais sur la carte. Inversement, un point
de vente qui n'a encore rien acheté n'est pas un client. Les deux se rejoignent
par le champ `PointVente.client` (facultatif), alimenté par l'action
« Convertir en client » lorsqu'un point devenu acheteur entre au fichier clients.

Ce module est contenu dans l'app Django **`prospection`**.

---

## 2. Structure des fichiers

```
prospection/
├── models.py            → Modèles (PointVente, Visite) + STATUT_CHOICES / STATUT_COULEURS
├── admin.py             → Configuration de l'admin Django (visites en inline)
├── apps.py              → Configuration de l'app
└── migrations/
    └── 0001_initial.py  → Migration initiale
```

L'interface est entièrement côté frontend Next.js (aucun template Django) :

```
front/src/
├── app/(app)/commercial/prospection/
│   ├── page.tsx              → Carte + filtres + liste latérale
│   └── [id]/page.tsx         → Fiche : contact, photos, historique des visites
├── components/app/
│   ├── carte-prospection.tsx → Carte Leaflet / OpenStreetMap
│   ├── form-point-vente.tsx  → Création / modification d'un point
│   ├── form-visite.tsx       → Saisie d'une visite (photo + GPS)
│   └── select-simple.tsx     → Liste déroulante des formulaires écrits à la main
└── lib/prospection.ts        → Statuts, couleurs, géolocalisation du navigateur
```

---

## 3. Modèles

### PointVente

| Champ | Type | Rôle |
|---|---|---|
| `nom` | CharField(200) | Nom du point de vente |
| `type_point` | CharField, choix | Boutique, Supermarché, Épicerie, Restaurant, Hôtel, Kiosque, Station-service, Grossiste, Entreprise, Autre |
| `latitude` / `longitude` | FloatField | Position GPS (obligatoire) |
| `adresse` | CharField(255) | Quartier, rue, point de repère |
| `contact_nom` / `contact_tel` / `contact_email` | — | Responsable sur place |
| `statut` | CharField, choix | Voir §4 |
| `potentiel_ca` | FloatField | Chiffre d'affaires mensuel estimé (XOF) |
| `date_prochaine_relance` | DateField, nullable | Déclenche l'alerte « en retard » |
| `commercial` | FK User, nullable | Commercial en charge |
| `client` | FK distribution.Client, nullable | Rempli par « Convertir en client » |
| `cree_le` | DateTimeField | Automatique |

Propriétés calculées : `couleur` (marqueur de la carte), `derniere_visite`,
`relance_en_retard` (date de relance dépassée).

### Visite

| Champ | Type | Rôle |
|---|---|---|
| `point_vente` | FK PointVente | Point visité |
| `commercial` | FK User, nullable | Déduit de l'utilisateur connecté |
| `date_visite` | DateTimeField | Date **et heure** du passage |
| `statut_constate` | CharField, choix, blank | Reporté sur le point à l'enregistrement |
| `compte_rendu` | TextField | Observations du commercial |
| `photo` | ImageField | Réduite à 1280 px au plus long côté (voir §6) |
| `latitude` / `longitude` | FloatField, nullable | Position relevée au moment du passage |

Une visite doit porter **au moins** un compte rendu, une photo ou un statut :
un passage sans trace exploitable est refusé.

---

## 4. Statuts et couleurs des marqueurs

| Statut | Libellé | Couleur du marqueur |
|---|---|---|
| `PROSPECTE` | Prospecté | 🔵 bleu |
| `INTERESSE` | Intéressé | 🔵 cyan |
| `CLIENT` | Client | 🟢 vert |
| `PARTENAIRE` | Point de vente partenaire | 🟣 violet |
| `A_RELANCER` | À relancer | 🟠 orange |
| `REFUS` | Non intéressé | 🔴 rouge |

La couleur est décidée par le serveur (`STATUT_COULEURS` dans `models.py`,
exposée via le champ `couleur` du serializer) : le frontend ne fait que la
traduire en valeur d'affichage, il n'y a donc pas deux tables de couleurs à
tenir à jour.

Un point au statut `A_RELANCER` exige une date de relance : sans elle, il ne
remonterait dans aucune alerte.

---

## 5. API REST

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/points-vente/` | Liste. Filtres : `?statut=A,B`, `?commercial=<id>`, `?relances=1` |
| POST | `/api/points-vente/` | Création (commercial déduit si non fourni) |
| GET | `/api/points-vente/<id>/` | Fiche complète **avec l'historique des visites** |
| PATCH / DELETE | `/api/points-vente/<id>/` | Modification / suppression |
| POST | `/api/points-vente/<id>/convertir_client/` | Crée la fiche client et rattache le point |
| GET | `/api/visites/` | Liste. Filtre : `?point_vente=<id>` |
| POST | `/api/visites/` | Création — **multipart** quand il y a une photo |

Permissions : `CanCommercial` — lecture pour Commercial / Finance / Direction,
écriture réservée au rôle Commercial (superusers et staff exceptés).

`/api/options/` expose en plus : `points_vente`, `statuts_prospection`,
`types_point_vente`, `commerciaux`.

### Effets de bord d'une visite

À l'enregistrement d'une visite, le point de vente est mis à jour :
- son `statut` prend la valeur de `statut_constate` (si renseigné) ;
- sa `date_prochaine_relance` prend la valeur envoyée avec la visite ;
- son `commercial`, s'il était vide, devient celui qui a visité.

Sans cette remontée, la carte continuerait d'afficher « Prospecté » en bleu
alors que le commercial vient de noter un refus.

---

## 6. Photos et fichiers médias

- `MEDIA_URL = '/media/'`, `MEDIA_ROOT = back/media/` (surchargeable par la
  variable d'environnement `MEDIA_ROOT`).
- Rangement par année/mois : `media/prospection/2026/08/…`.
- **Redimensionnement automatique à 1280 px** au plus long côté, avec
  correction de l'orientation EXIF (les photos prises en mode portrait
  s'afficheraient couchées sans cela). Les clichés de téléphone font 4 à 8 Mo :
  sans réduction, quelques centaines de visites satureraient le disque du VPS.
- En développement, Django sert `/media/` lui-même (`DEBUG=True`).
- En production, **nginx** sert `/media/` directement depuis le disque
  (bloc `location /media/` dans `deploy/nginx-jusorange.conf`) : WhiteNoise ne
  gère que les statiques, et faire transiter des photos par gunicorn le
  bloquerait pendant tout le transfert.
- Dépendance : `Pillow` (ajoutée à `requirements.txt`).

---

## 7. Carte (frontend)

- **Leaflet 1.9** avec les tuiles **OpenStreetMap** : aucune clé d'API, aucun
  compte à ouvrir. L'attribution OSM est obligatoire et figure sur la carte.
- Leaflet touche `window` dès son chargement : il est importé dynamiquement
  dans un effet, jamais au niveau du module, sinon le rendu serveur de Next
  planterait.
- Les marqueurs sont des `divIcon` (pastilles CSS colorées) et non les icônes
  Leaflet par défaut, dont les images se perdent au bundling et qui ne savent
  pas porter une couleur par statut.
- Un halo orange signale les relances en retard.

### Géolocalisation

Le bouton « Me localiser » utilise `navigator.geolocation` en haute précision.
Le navigateur ne l'expose **qu'en HTTPS** (ou sur `localhost`). C'est le cas
depuis le 10/08/2026 sur <https://jus.gdamali.net> : les commerciaux doivent
donc utiliser cette adresse. Sur l'accès de diagnostic par IP, qui reste en
HTTP simple, un message explique qu'il faut placer le point sur la carte.

---

## 8. Déploiement

1. `pip install -r back/requirements.txt` (installe Pillow).
2. `python manage.py migrate` (applique `prospection.0001_initial`).
3. Recopier `deploy/nginx-jusorange.conf` puis `nginx -t && systemctl reload nginx`
   (nouveau bloc `location /media/`).
4. Créer le dossier et lui donner les droits :
   `mkdir -p /opt/jusorange/back/media && chown -R jusorange:jusorange /opt/jusorange/back/media`.
5. **Sauvegardes** : `back/media/` n'est pas dans Git. Il doit être inclus dans
   la sauvegarde du VPS au même titre que la base — les photos ne sont nulle
   part ailleurs.
