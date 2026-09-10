# Documentation — Module Reporting
## Projet JusOrange GDA

---

## 1. Présentation du module

Le module **Reporting** fournit des tableaux de bord et des rapports détaillés sur l'ensemble des modules de l'application :
- **Accueil Direction** : vue globale (lecture seule) avec KPIs de tous les modules
- **Dashboard** : KPIs globaux par module (Récolte, Appro, Production, Conditionnement, Inventaire, Commercialisation)
- **Rapports détaillés** : tableaux par module avec filtrage par période
- **Exports Excel** : téléchargement des rapports au format .xlsx
- **Graphiques** : évolution du CA, de la récolte et de la production par mois
- **Filtres prédéfinis** : Semaine, Mois en cours, Trimestre

Ce module est contenu dans l'app Django **`reporting`**.

---

## 2. Structure des fichiers

```
reporting/
├── models.py          → (vide, pas de modèle propre)
├── views.py           → Accueils (resprod, commercial, finance, direction) + Dashboard + 6 vues de rapport
├── urls.py            → URLs du module
├── tests.py           → Tests unitaires (services, vues)
├── exports.py         → Exports Excel (openpyxl)
├── services/
│   ├── base.py        → get_period_from_request, filtres période
│   ├── charts.py      → Données pour graphiques Chart.js
│   ├── recolte.py     → Stats + rapport récolte
│   ├── appro.py       → Stats + rapport appro
│   ├── fabrication.py → Stats + rapport fabrication
│   ├── emballage.py   → Stats + rapport emballage
│   ├── entrepot.py    → Stats + rapport entrepot
│   └── distribution.py→ Stats + rapport distribution
└── (pas de templates dans l'app, tout dans templates/reporting/)

templates/
├── reporting/
│   ├── dashboard.html
│   ├── rapport_recolte.html
│   ├── rapport_appro.html
│   ├── rapport_fabrication.html
│   ├── rapport_emballage.html
│   ├── rapport_entrepot.html
│   └── rapport_distribution.html
└── direction/
    └── accueil.html   → Accueil Direction (vue globale)
```

---

## 3. URLs

| URL | Vue | Description |
|-----|-----|-------------|
| `/direction/` | accueil_direction | Accueil Direction — vue globale (lecture seule) |
| `/reporting/` | dashboard | Tableau de bord avec KPIs et graphiques |
| `/reporting/recolte/` | rapport_recolte | Rapport détaillé cueillettes |
| `/reporting/appro/` | rapport_appro | Rapport détaillé réceptions |
| `/reporting/fabrication/` | rapport_fabrication | Rapport détaillé productions |
| `/reporting/emballage/` | rapport_emballage | Rapport détaillé conditionnements |
| `/reporting/entrepot/` | rapport_entrepot | Rapport détaillé inventaires |
| `/reporting/distribution/` | rapport_distribution | Rapport détaillé ventes et commandes |

**Paramètres GET :**
- `date_debut`, `date_fin` : période personnalisée (format YYYY-MM-DD)
- `periode` : `semaine` | `mois` | `trimestre` (remplace les dates)
- `format=excel` : sur une URL de rapport, déclenche le téléchargement Excel

---

## 4. Filtres de période

| Paramètre | Période |
|-----------|---------|
| `periode=semaine` | 7 derniers jours |
| `periode=mois` | 1er du mois en cours → aujourd'hui |
| `periode=trimestre` | 3 derniers mois + mois en cours |
| `date_debut` + `date_fin` | Période personnalisée |

---

## 5. Contenu des rapports

### 5.1 — Récolte
- **Par producteur** : agrégat (nb cueillettes, qté totale, qté bonne)
- **Par zone** : agrégat (nb cueillettes, qté totale, qté bonne)
- **Détail** : cueillettes (producteur, date, quantités, taux qualité, observation)

### 5.2 — Appro
- **Évolution** : réceptions oranges (qté bonne) par mois
- **Stock actuel** : quantité et seuil par article
- **Réceptions** : N°, date, cueillette, quantités, lieu dépôt
- Alertes : articles sous seuil

### 5.3 — Fabrication
- Productions : N° OF, date, recette, statut, volume, test qualité

### 5.4 — Emballage
- **Bouteilles par statut** : répartition DISPO, VENDUE, PERIMEE, REBUT
- **Liste bouteilles** : conditionnements de la période (200 max)
- Conditionnements : N°, date, production, 33cl, 1L, volume, DLC

### 5.5 — Inventaire
- Inventaires : date, article, qté système/dépôt, écart, statut, qualité

### 5.6 — Distribution
- Ventes : date, client, montant, statut paiement
- Commandes : date, client, 33cl, 1L, vente liée
- **Factures** : N°, date, client, montant, statut, échéance
- **Paiements** : date, client, facture, montant, mode
- **Trésorerie** : réceptions paiements (déclaré, reçu, écart, traîté, observation/justification)

---

## 6. Exports Excel

Chaque rapport dispose d'un bouton **Export Excel**. Le fichier téléchargé contient :
- En-tête avec la période
- Tableau des données du rapport

Dépendance : `openpyxl` (voir `requirements.txt`).

---

## 7. Graphiques (Dashboard)

Le dashboard affiche 3 graphiques (Chart.js) :
- **CA (XOF)** : ventes par mois
- **Récolte (kg)** : qte_bon des cueillettes par mois
- **Production (L)** : volume_final_l des productions terminées par mois

---

## 8. Dépendances

- **Django** : framework (4.2 pour MariaDB 10.4, 6.0 pour MariaDB 10.6+)
- **PyMySQL** : driver MySQL (compatible mysqlclient)
- **openpyxl** : exports Excel
- **Chart.js** : chargé via CDN (pas d'installation)

## 9. Base de données

- **MySQL / MariaDB** : base `jusorange` (voir [DocuDB.md](DocuDB.md))
