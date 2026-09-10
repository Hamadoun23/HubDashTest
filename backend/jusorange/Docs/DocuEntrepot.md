# Documentation — Module Entrepot
## Projet JusOrange GDA

---

## 1. Présentation du module

Le module **Entrepot** gère les **inventaires** de tous les articles en stock :
- La vue par type d'article avec la date du dernier inventaire
- La liste des inventaires liés à chaque article
- La saisie des résultats de comptage physique (qté dépôt)
- Le calcul automatique des écarts (qté dépôt − qté système)

Ce module est contenu dans l'app Django **`entrepot`**.

---

## 2. Structure des fichiers

```
entrepot/
├── models.py          → Modèle Inventaire
├── admin.py           → Configuration de l'admin Django
├── forms.py           → InventaireForm
├── views.py           → 5 vues (liste, liste par article, ajouter, modifier, supprimer)
├── urls.py            → 5 URLs
├── apps.py            → Configuration de l'app
├── tests.py           → Tests unitaires (modèles, formulaires)
└── migrations/
    └── 0001_initial.py → Migration unique

templates/
└── entrepot/
    ├── liste_inventaires.html           → Types d'articles + date dernier inventaire
    ├── liste_inventaires_article.html    → Inventaires d'un article
    ├── form_inventaire.html             → Formulaire ajouter/modifier
    └── confirmer_suppression_inventaire.html
```

---

## 3. Modèle de données

### 3.1 — Inventaire

| Champ        | Type               | Description                                      |
|--------------|--------------------|--------------------------------------------------|
| id           | AutoField          | Clé primaire                                     |
| date_inv     | DateField          | Date de l'inventaire                             |
| qte_systeme  | FloatField         | Stock actuel de l'article dans l'app au moment de l'inventaire |
| qte_depot    | FloatField         | Résultat du comptage physique (saisi par l'utilisateur) |
| ecart        | FloatField         | Calculé automatiquement : qte_depot − qte_systeme |
| statut       | CharField(20)      | EN_COURS, TERMINE, BLOQUE                        |
| qualite      | CharField(20)      | BON, MOYEN, MAUVAIS — calculée automatiquement selon l'écart |
| observation  | TextField          | Observation (optionnel)                         |
| article      | ForeignKey         | Lien vers ArticleStock — CASCADE                 |
| user         | ForeignKey(User)   | Responsable (optionnel, nullable)                |

**Champs calculés automatiquement :**
- `qte_systeme` = capturé à la création depuis `article.qte_art`
- `ecart` = `qte_depot - qte_systeme` (calculé dans `save()`)
- `qualite` = selon l'écart : ≤ 5 % → BON ; ≤ 15 % → MOYEN ; sinon MAUVAIS (calculé dans `save()`)

**Statuts possibles :** EN_COURS (En cours), TERMINE (Terminé), BLOQUE (Bloqué)

**Règles :**
- La quantité système représente le stock actuel au moment de la saisie
- L'utilisateur renseigne uniquement la quantité au dépôt (résultat du comptage physique)
- L'écart est toujours recalculé à chaque sauvegarde
- L'observation se fait **après** l'inventaire : obligatoire lorsque le statut est « Terminé »

### 3.2 — Relations

```
ArticleStock (1) ←──────────── (0..*) Inventaire
```

- Un article peut avoir plusieurs inventaires (historique)
- Chaque inventaire est lié à un seul article

---

## 4. Logique métier

### 4.1 — Vue principale (liste_inventaires)

- Affiche tous les **types d'articles** (ArticleStock)
- Pour chaque article : **date du dernier inventaire** (ou « Jamais inventorié »)
- Bouton **« Voir inventaires »** → liste des inventaires de cet article

### 4.2 — Vue par article (liste_inventaires_article)

- Affiche les inventaires d'un article donné
- Tri par date décroissante
- Boutons Modifier / Supprimer avec redirection vers cette page après l'action (`?article=<pk>`)

### 4.3 — Création d'un inventaire

1. L'utilisateur sélectionne l'article et saisit la **quantité au dépôt**
2. À l'enregistrement : `qte_systeme = article.qte_art` (capture du stock actuel)
3. Calcul automatique de l'écart dans `save()`

### 4.4 — Modification / Suppression

- Paramètre `?article=<pk>` dans l'URL pour rediriger vers la liste de l'article après l'action
- Si absent : redirection vers la vue principale

### 4.5 — Intégration avec le module Appro

- Les articles proviennent de **ArticleStock** (module appro)
- Tous les types d'articles sont inventoriables : orange_dispo, bouteille_vide_33cl, bouteille_vide_1l, preforme_33cl, preforme_1l, jus_33cl, jus_1l

---

## 5. URLs

| URL                                              | Vue                        | Action                      |
|--------------------------------------------------|----------------------------|-----------------------------|
| `/inventaires/`                                  | liste_inventaires          | Types d'articles + date dernier inventaire |
| `/inventaires/article/<int:pk>/`                | liste_inventaires_article  | Inventaires d'un article    |
| `/inventaires/ajouter/`                          | ajouter_inventaire         | Formulaire d'ajout          |
| `/inventaires/modifier/<int:pk>/`               | modifier_inventaire        | Formulaire de modification  |
| `/inventaires/supprimer/<int:pk>/`              | supprimer_inventaire       | Confirmation suppression    |

---

## 6. Formulaires

### InventaireForm

- **Champs :** date_inv, article, qte_depot, statut, observation, user
- **Exclus :** qte_systeme, ecart, qualite (calculés automatiquement en base)
- **Aide qte_depot :** "Renseignez le résultat du comptage physique. La quantité système, l'écart et la qualité sont calculés automatiquement."

---

## 7. Vues (views.py)

| Vue                     | Méthode HTTP | Description                                |
|-------------------------|--------------|--------------------------------------------|
| liste_inventaires       | GET          | Types d'articles avec date dernier inventaire |
| liste_inventaires_article | GET        | Inventaires d'un article                    |
| ajouter_inventaire      | GET / POST   | Ajoute un inventaire (qte_systeme capturée auto) |
| modifier_inventaire     | GET / POST   | Modifie un inventaire (redirection contextuelle) |
| supprimer_inventaire    | GET / POST   | Confirmation puis suppression              |

---

## 8. Admin Django

### InventaireAdmin

- **Colonnes :** id, date_inv, article, qte_systeme, qte_depot, ecart, statut, qualite, user
- **Recherche :** article__type_art, observation
- **Filtres :** statut, date_inv

---

## 9. Configuration du projet

### settings.py

- `'entrepot.apps.EntrepotConfig'` dans `INSTALLED_APPS`

### JusOrange/urls.py

- `path('', include('entrepot.urls'))` pour brancher les URLs du module

### Données de test (populate_sample)

- Création de 5 inventaires de test (TERMINE, EN_COURS, BLOQUE / BON, MOYEN, MAUVAIS)
- Suppression des inventaires lors du vidage de la base

---

## 10. Résumé technique

| Élément               | Valeur                        |
|-----------------------|-------------------------------|
| Nom de l'app          | entrepot                      |
| Nombre de modèles     | 1 (Inventaire)                |
| Nombre de vues        | 5                             |
| Nombre de URLs        | 5                             |
| Nombre de formulaires | 2 (InventaireForm, InventaireObservationForm) |
| Nombre de templates   | 4                             |
| Migration             | 1 fichier (0001_initial.py, inclut qualite) |
| Dépendances           | appro (ArticleStock), django.contrib.auth (User) |
| Base de données       | MySQL / MariaDB (jusorange)   |
