# Documentation — Module Appro
## Projet JusOrange GDA

---

## 1. Présentation du module

Le module **Appro** (Approvisionnement) gère :
- La gestion des **Articles en stock** (paramétrage, actualisation du stock)
- La gestion des **Réceptions** d'oranges (réception des cueillettes des producteurs)

Ce module est contenu dans l'app Django **`appro`**.

---

## 2. Structure des fichiers

```
appro/
├── models.py          → Modèles (ArticleStock, Reception)
├── admin.py           → Configuration de l'admin Django
├── forms.py           → Formulaires avec validation
├── views.py           → 10 vues (CRUD Articles + CRUD Réceptions)
├── urls.py            → 10 URLs
├── apps.py            → Configuration de l'app (charge les signaux)
├── signals.py         → Signaux pre_delete (archivage cueillette)
├── tests.py           → Tests unitaires (modèles, formulaires)
└── migrations/
    └── 0001_initial.py → Migration unique

templates/
└── appro/
    ├── liste_articles.html           → Liste des articles en stock
    ├── form_article.html             → Formulaire paramétrage article
    ├── choix_actualiser.html         → Choix de l'article à actualiser
    ├── form_actualiser.html         → Formulaire actualisation stock
    ├── confirmer_suppression_article.html
    ├── liste_receptions.html         → Liste des réceptions
    ├── form_reception.html           → Formulaire réception
    └── confirmer_suppression_reception.html
```

---

## 3. Modèles de données

### 3.1 — ArticleStock

| Champ        | Type               | Description                                      |
|--------------|--------------------|--------------------------------------------------|
| id           | AutoField          | Clé primaire                                     |
| type_art     | CharField(50)      | Type d'article (unique) : bouteille_vide_33cl, bouteille_vide_1l, preforme_33cl, preforme_1l, orange_dispo, jus_33cl, jus_1l |
| qte_art      | FloatField         | Quantité en stock (mise à jour manuelle ou auto)  |
| seuil_alerte | FloatField         | Seuil minimum avant alerte stock bas             |
| date_maj     | DateTimeField     | Dernière mise à jour (auto)                      |
| prix_33cl    | FloatField         | Prix 33cl (XOF) — pour jus_33cl uniquement         |
| prix_1l      | FloatField         | Prix 1L (XOF) — pour jus_1l uniquement             |

**Types d'articles :**
- **Bouteille vide 33cl / 1L** : stock actualisé manuellement
- **Préforme 33cl / Préforme 1L** : stock actualisé manuellement (deux types distincts)
- **Orange disponible** : stock calculé automatiquement (somme des qte_bon des réceptions)
- **Jus 33cl / Jus 1L** : produits finis ; stock synchronisé par le module Emballage ; prix utilisés par le module Distribution

**Règles :**
- Chaque type n'existe qu'une seule fois (`unique=True`)
- Le stock des oranges est géré uniquement via les réceptions

### 3.2 — Reception

| Champ            | Type               | Description                                      |
|------------------|--------------------|--------------------------------------------------|
| id               | AutoField          | Clé primaire                                     |
| cueillette       | ForeignKey         | Lien vers Cueillette (nullable si supprimée)      |
| cueillette_archive | CharField(250)   | Info archivée quand la cueillette est supprimée  |
| num_recp         | CharField(30)      | N° réception auto : N001JGDA12022026, N002...    |
| date_recp        | DateField          | Date de réception                                |
| qte_recue        | FloatField         | Quantité reçue (kg)                              |
| qte_bon          | FloatField         | Quantité bonne qualité (kg)                      |
| qte_mauvais      | FloatField         | Calculé auto : qte_recue - qte_bon               |
| lieu_depot       | CharField(100)     | Lieu de dépôt                                   |
| cause_perte      | TextField          | Cause de perte (optionnel)                       |
| articles         | ManyToManyField    | Lien vers ArticleStock (orange_dispo auto-lié)   |

**Champs calculés automatiquement :**
- `qte_mauvais` = qte_recue - qte_bon
- `num_recp` = N001JGDA12022026 (par date : N001, N002... ; reset à N001 quand la date change)
- `taux_qualite` = (qte_bon / qte_recue) * 100 (%) — `@property`
- `etat_qualite` = EXCELLENT / BON / MAUVAIS selon le taux — `@property`

**Règles de suppression :**
- Si une cueillette est supprimée, les réceptions restent avec `cueillette_archive` rempli
- Affichage via `get_cueillette_display()` : cueillette ou "info (supprimée)"

### 3.3 — Relations entre les modèles

```
Cueillette (1) ──────→ (0..*) Reception
Reception (0..*) ←──→ (0..*) ArticleStock
```

- Une réception est liée à une cueillette (ou archive si supprimée)
- Les réceptions concernent les oranges disponibles (article orange_dispo)
- Chaque réception met à jour automatiquement le stock d'oranges disponibles

---

## 4. Logique métier

### 4.1 — Paramétrage vs Actualisation (Articles)

| Action              | Description                                           | S'applique à                    |
|---------------------|-------------------------------------------------------|---------------------------------|
| **Paramétrer**      | Créer un article ou modifier seuil d'alerte          | Tous les types                  |
| **Actualiser stock**| Ajouter une quantité au stock existant               | Bouteille vide, Préforme uniquement |

Le stock des **oranges disponibles** est mis à jour automatiquement à chaque réception enregistrée.

### 4.2 — Règle des réceptions

**Contrainte :** On ne peut réceptionner que les **bonnes oranges** d'une cueillette.

- Le total des `qte_recue` de toutes les réceptions liées à une cueillette ne doit **pas dépasser** la `qte_bon` de cette cueillette.
- Seules les cueillettes ayant encore un restant à réceptionner apparaissent dans le formulaire.

### 4.3 — Format num_recp

- Format : `N001JGDA12022026`, `N002JGDA12022026`, etc.
- `N001`, `N002` : numéro séquentiel par date
- `JGDA` : préfixe fixe
- `12022026` : date (JJMMAAAA)
- Quand la date change, le numéro repart à N001

---

## 5. URLs

### Articles

| URL                                              | Vue                        | Action                      |
|--------------------------------------------------|----------------------------|-----------------------------|
| `/articles/`                                    | liste_articles             | Lister tous les articles    |
| `/articles/parametrer/`                          | parametrer_article         | Créer un nouvel article     |
| `/articles/parametrer/<int:pk>/`                 | parametrer_article_modifier| Modifier seuil d'alerte     |
| `/articles/actualiser/`                         | actualiser_article_choix   | Choix de l'article à actualiser |
| `/articles/actualiser/<int:pk>/`                | actualiser_article         | Ajouter du stock            |
| `/articles/supprimer/<int:pk>/`                 | supprimer_article         | Confirmation suppression    |

### Réceptions

| URL                                              | Vue                    | Action                      |
|--------------------------------------------------|------------------------|-----------------------------|
| `/receptions/`                                  | liste_receptions       | Lister toutes les réceptions |
| `/receptions/ajouter/`                          | ajouter_reception      | Formulaire d'ajout          |
| `/receptions/modifier/<int:pk>/`               | modifier_reception     | Formulaire de modification  |
| `/receptions/supprimer/<int:pk>/`              | supprimer_reception    | Confirmation suppression    |

---

## 6. Formulaires

### ArticleStockCreateForm
- Champs : type_art, seuil_alerte
- Utilisé pour créer et modifier le paramétrage (seuil d'alerte)

### ArticleStockUpdateForm
- Champ : qte_ajout (quantité à ajouter)
- Utilisé pour actualiser le stock (ajout au stock existant)

### ReceptionForm
- Champs : cueillette, date_recp, qte_recue, qte_bon, lieu_depot, cause_perte
- **Filtre cueillettes :** affiche uniquement celles ayant un restant à réceptionner
- **Validation :** qte_recue ne doit pas dépasser le restant disponible pour la cueillette
- Si réception avec cueillette supprimée : champ cueillette masqué

---

## 7. Signaux (signals.py)

Avant la suppression d'une **Cueillette**, le signal `pre_delete` :
1. Enregistre les infos (producteur, date, qté bonne) dans `cueillette_archive` pour chaque réception liée
2. Django applique ensuite `SET_NULL` sur le champ `cueillette` des réceptions

Résultat : les réceptions restent en base et affichent « Info cueillette (supprimée) » via `get_cueillette_display()`.

---

## 8. Admin Django

### ArticleStockAdmin
- Colonnes : type_art, qte_art, seuil_alerte, date_maj

### ReceptionAdmin
- Colonnes : num_recp, get_cueillette_display, date_recp, qte_recue, qte_bon, taux_qualite, etat_qualite
- Recherche : num_recp, cueillette_archive

---

## 9. Configuration du projet

### settings.py
- `'appro.apps.ApproConfig'` dans `INSTALLED_APPS` (charge les signaux via `ready()`)

### JusOrange/urls.py
- `path('', include('appro.urls'))` pour brancher les URLs du module

---

## 10. Résumé technique

| Élément               | Valeur                        |
|-----------------------|-------------------------------|
| Nom de l'app          | appro                         |
| Nombre de modèles     | 2 (ArticleStock, Reception)  |
| Nombre de vues        | 10                            |
| Nombre de URLs        | 10                            |
| Nombre de formulaires | 3                             |
| Dépendance            | recolte (Cueillette)          |
| Utilisé par           | emballage (stock jus), distribution (prix jus) |
| Base de données       | MySQL / MariaDB (jusorange)   |
