# Documentation — Module Emballage
## Projet JusOrange GDA

---

## 1. Présentation du module

Le module **Emballage** gère :
- La mise en bouteille des productions de jus (**Conditionnements**)
- La gestion des **Bouteilles** de jus fini (33cl et 1L)
- La synchronisation des stocks de jus avec le module Appro (`jus_33cl`, `jus_1l`)
- La décrémentation des stocks de bouteilles vides (33cl et 1L) à chaque conditionnement

Ce module est contenu dans l'app Django **`emballage`**.

---

## 2. Structure des fichiers

```
emballage/
├── models.py          → Modèles (Conditionnement, Bouteille)
├── admin.py           → Configuration de l'admin Django
├── forms.py           → Formulaires (ConditionnementForm, BouteilleForm)
├── views.py           → 7 vues (CRUD Conditionnements + liste/modifier/supprimer Bouteilles)
├── urls.py            → 7 URLs
├── apps.py            → Configuration de l'app
├── tests.py           → Tests unitaires (modèles, add_months, formulaires)
└── migrations/
    └── 0001_initial.py → Migration unique

templates/
└── emballage/
    ├── liste_conditionnements.html
    ├── form_conditionnement.html
    ├── confirmer_suppression_conditionnement.html
    ├── liste_bouteilles.html
    ├── form_bouteille.html
    └── confirmer_suppression_bouteille.html
```

---

## 3. Modèles de données

### 3.1 — Conditionnement

| Champ           | Type               | Description                                      |
|-----------------|--------------------|--------------------------------------------------|
| id              | AutoField          | Clé primaire                                     |
| date_cond       | DateField          | Date de conditionnement                           |
| numero_cond     | CharField(30)      | N° conditionnement auto : COND00110022026, COND002... (éditable=False) |
| qte_33cl        | IntegerField       | Quantité de bouteilles 33cl                       |
| qte_1l          | IntegerField       | Quantité de bouteilles 1L                         |
| volume_utilisee | FloatField         | Volume utilisée (L) — obligatoire                |
| dlc             | DateField          | Date limite de consommation (calculée auto)       |
| observation     | TextField          | Observation — obligatoire (non vide)              |
| production      | OneToOneField      | Production (1 prod = 1 conditionnement max)      |
| user            | ForeignKey(User)   | Responsable (optionnel, nullable)                |

**Champs calculés automatiquement :**
- `numero_cond` = COND00110022026, COND002... (numéro séquentiel par date ; reset à COND001 quand la date change)
- `dlc` = calculée à partir de nb_jours ou nb_mois (un seul des deux) dans le formulaire

**Règles :**
- Une production ne peut être utilisée que pour **un seul** conditionnement (OneToOneField)
- Au moins qte_33cl ou qte_1l > 0
- volume_utilisee > 0 et observation non vide
- Stock bouteilles vides 33cl et 1L vérifié avant validation

### 3.2 — Bouteille

| Champ           | Type               | Description                                      |
|-----------------|--------------------|--------------------------------------------------|
| id              | AutoField          | Clé primaire                                     |
| format_33cl     | IntegerField       | 1 = 33cl, 0 = non                                |
| format_1l       | IntegerField       | 1 = 1L, 0 = non                                  |
| codebar         | CharField(100)     | Code-barres (optionnel)                          |
| dlc             | DateField          | Date limite de consommation                      |
| statut_stock    | CharField(20)      | DISPO, VENDUE, PERIMEE, REBUT                    |
| date_creation   | DateField          | Date de création (auto_now_add)                  |
| article_stock   | ForeignKey         | Article stock (bouteille_vide_33cl ou 1l) — SET_NULL |
| conditionnement | ForeignKey         | Lien vers Conditionnement — CASCADE              |
| commande        | ForeignKey         | Commande (distribution) — SET_NULL (si vendue)   |

**Statuts possibles :** DISPO (Disponible), VENDUE, PERIMEE (Périmée), REBUT

**Méthode :** `get_format_display()` → "33 cl" ou "1 L"

**Règles :**
- Les bouteilles sont créées **automatiquement** lors de l'ajout d'un conditionnement
- Pas de bouton « Ajouter bouteille » : les bouteilles proviennent uniquement des conditionnements

### 3.3 — Relations entre les modèles

```
Production (1)  ←──OneToOne──→  (1) Conditionnement
Conditionnement (1) ─────────────────→ (0..*) Bouteille
Bouteille (0..*) ─────────────────────→ (1) ArticleStock (bouteille_vide_33cl ou 1l)
Bouteille (0..*) ─────────────────────→ (0..1) Commande (distribution, si vendue)
```

- Une production terminée ne peut être conditionnée **qu'une seule fois**
- Un conditionnement crée N bouteilles (qte_33cl + qte_1l)
- Chaque bouteille est liée à l'article bouteille_vide_33cl ou bouteille_vide_1l consommé

---

## 4. Logique métier

### 4.1 — Création d'un conditionnement

1. L'utilisateur remplit le formulaire (production, quantités, volume, DLC, observation)
2. **Validation :** stock bouteilles vides 33cl et 1L suffisant
3. **Enregistrement** du conditionnement
4. **Création automatique** des bouteilles (bulk_create)
5. **Décrémentation** des stocks bouteille_vide_33cl et bouteille_vide_1l
6. **Mise à jour** des articles jus_33cl et jus_1l (`maj_stock_jus()`)

### 4.2 — Production unique par conditionnement

- Seules les productions **terminées** et **non encore conditionnées** sont proposées dans le formulaire
- Une fois conditionnée, une production disparaît des choix pour les nouveaux conditionnements
- En modification, la production actuelle reste dans la liste

### 4.3 — Format numero_cond

- Format : `COND00110022026`, `COND00210022026`, etc.
- `COND001`, `COND002` : numéro séquentiel par date
- `10022026` : date (JJMMAAAA)
- Quand la date change, le numéro repart à COND001

### 4.4 — DLC (Date limite de consommation)

- Saisie via **nb_jours** ou **nb_mois** (un seul des deux)
- Calcul : `dlc = date_cond + nb_jours` ou `dlc = add_months(date_cond, nb_mois)`
- En modification, le champ nb_jours est pré-rempli si DLC > date_cond

### 4.5 — Synchronisation stock jus (`maj_stock_jus()`)

La fonction `maj_stock_jus()` met à jour les articles **jus_33cl** et **jus_1l** :
- `qte_art` = nombre de bouteilles DISPO (format_33cl=1 ou format_1l=1)
- `date_maj` = mise à jour automatique

**Appelée dans :**
- `creer_bouteilles_et_maj_stock` (après création de bouteilles)
- `modifier_bouteille` (changement de statut)
- `supprimer_bouteille`
- `supprimer_conditionnement`
- `liste_articles` (module appro, avant affichage)

### 4.6 — Intégration avec le module Appro

- Les articles **Jus 33cl** et **Jus 1L** sont affichés dans la liste des articles (section « Produits finis »)
- Chaque article affiche : quantité, seuil d'alerte, dernière mise à jour, statut, bouton « Voir bouteilles »
- Le seuil d'alerte des jus est paramétrable via « Paramétrer » (seul champ modifiable)
- Quantité et stock synchronisés par `maj_stock_jus()`

### 4.7 — Intégration avec le module Distribution

- Lors de la **complétion d'une commande**, les bouteilles DISPO sont assignées à la commande et passent en statut VENDUE
- Le champ `commande` (ForeignKey vers distribution.Commande) permet de tracer les bouteilles vendues

---

## 5. URLs

### Conditionnements

| URL                                              | Vue                        | Action                      |
|--------------------------------------------------|----------------------------|-----------------------------|
| `/conditionnements/`                            | liste_conditionnements     | Lister tous les conditionnements |
| `/conditionnements/ajouter/`                     | ajouter_conditionnement    | Formulaire d'ajout          |
| `/conditionnements/modifier/<int:pk>/`          | modifier_conditionnement   | Formulaire de modification  |
| `/conditionnements/supprimer/<int:pk>/`         | supprimer_conditionnement  | Confirmation suppression    |

### Bouteilles

| URL                                              | Vue                    | Action                      |
|--------------------------------------------------|------------------------|-----------------------------|
| `/bouteilles/`                                   | liste_bouteilles       | Lister toutes les bouteilles (filtre ?format=33cl ou ?format=1l) |
| `/bouteilles/modifier/<int:pk>/`                | modifier_bouteille     | Modifier une bouteille      |
| `/bouteilles/supprimer/<int:pk>/`               | supprimer_bouteille    | Confirmation suppression   |

---

## 6. Formulaires

### ConditionnementForm

- **Champs :** date_cond, production, qte_33cl, qte_1l, volume_utilisee, observation, user
- **Champs virtuels :** nb_jours, nb_mois (pour le calcul de la DLC)
- **Filtre productions :** uniquement terminées et non encore conditionnées
- **Validation :** volume > 0, observation non vide, au moins qte_33cl ou qte_1l > 0, stock bouteilles vides suffisant, production non déjà utilisée
- **DLC :** calculée à partir de nb_jours ou nb_mois (exclusif)

### BouteilleForm

- **Champs :** tous (model form)
- **Utilisé pour :** modifier une bouteille (dlc, statut_stock, codebar, etc.)

---

## 7. Vues (views.py)

| Vue                     | Méthode HTTP | Description                                |
|-------------------------|--------------|--------------------------------------------|
| liste_conditionnements  | GET          | Affiche tous les conditionnements          |
| ajouter_conditionnement | GET / POST   | Ajoute un conditionnement + crée les bouteilles |
| modifier_conditionnement | GET / POST | Modifie un conditionnement                 |
| supprimer_conditionnement | GET / POST | Supprime un conditionnement + maj_stock_jus |
| liste_bouteilles        | GET          | Affiche les bouteilles (filtre format optionnel) |
| modifier_bouteille      | GET / POST   | Modifie une bouteille + maj_stock_jus       |
| supprimer_bouteille     | GET / POST   | Supprime une bouteille + maj_stock_jus      |

---

## 8. Admin Django

### ConditionnementAdmin

- **Colonnes :** numero_cond, date_cond, production, qte_33cl, qte_1l, volume_utilisee, dlc, user
- **Recherche :** numero_cond
- **Filtres :** date_cond
- **Champs en lecture seule :** numero_cond
- **Fieldsets :** Identification, Quantités, Autres

### BouteilleAdmin

- **Colonnes :** id, conditionnement, get_format_display, codebar, statut_stock, dlc, date_creation
- **Recherche :** codebar
- **Filtres :** statut_stock, conditionnement
- **Édition rapide :** statut_stock

---

## 9. Configuration du projet

### settings.py

- `'emballage.apps.EmballageConfig'` dans `INSTALLED_APPS`

### JusOrange/urls.py

- `path('', include('emballage.urls'))` pour brancher les URLs du module

---

## 10. Résumé technique

| Élément               | Valeur                        |
|-----------------------|-------------------------------|
| Nom de l'app          | emballage                     |
| Nombre de modèles     | 2 (Conditionnement, Bouteille) |
| Nombre de vues        | 7                             |
| Nombre de URLs        | 7                             |
| Nombre de formulaires | 2 (ConditionnementForm, BouteilleForm) |
| Nombre de templates   | 6                             |
| Migration             | 1 fichier (0001_initial.py)   |
| Dépendances           | appro (ArticleStock), fabrication (Production), distribution (Commande), django.contrib.auth (User) |
| Base de données       | MySQL / MariaDB (jusorange)   |
