# Documentation — Module Récolte
## Projet JusOrange GDA

---

## 1. Présentation du module

Le module **Récolte** gère deux fonctionnalités principales :
- La gestion des **Producteurs** d'oranges (ajout, modification, suppression, liste)
- La gestion des **Cueillettes** (ajout, modification, suppression, liste)

Ce module est contenu dans l'app Django **`recolte`**.

---

## 2. Structure des fichiers

```
recolte/
├── models.py          → Modèles (Producteur, Cueillette)
├── admin.py           → Configuration de l'admin Django
├── forms.py           → Formulaires avec validation
├── views.py           → 8 vues (CRUD Producteur + CRUD Cueillette)
├── urls.py            → 8 URLs
├── apps.py            → Configuration de l'app (charge les signaux)
├── signals.py         → Signaux pre_delete (archivage producteur)
├── tests.py           → Tests unitaires (modèles Producteur, Cueillette)
├── management/
│   └── commands/
│       └── populate_sample.py → Commande pour données fictives
└── migrations/
    └── 0001_initial.py → Migration unique

templates/
├── base.html                                    → Template de base (CSS + navigation)
└── recolte/
    ├── liste_producteurs.html                   → Liste des producteurs
    ├── form_producteur.html                     → Formulaire ajout/modification producteur
    ├── confirmer_suppression_producteur.html     → Confirmation suppression producteur
    ├── liste_cueillettes.html                   → Liste des cueillettes
    ├── form_cueillette.html                     → Formulaire ajout/modification cueillette
    └── confirmer_suppression_cueillette.html     → Confirmation suppression cueillette
```

---

## 3. Modèles de données

### 3.1 — Producteur

| Champ          | Type               | Description                                      |
|----------------|--------------------|--------------------------------------------------|
| id             | AutoField          | Clé primaire (créée automatiquement par Django)  |
| nom_complet    | CharField(100)     | Nom et prénom du producteur                      |
| zone           | CharField(100)     | Zone géographique                                |
| contact        | CharField(20)      | Numéro de téléphone                              |
| adresse        | TextField          | Adresse complète (optionnel)                     |
| actif          | BooleanField       | Producteur actif ou non (True par défaut)        |
| date_creation  | DateTimeField      | Date de création (auto, remplie à la création)   |

**Tri par défaut :** ordre alphabétique du nom (`ordering = ['nom_complet']`)

### 3.2 — Cueillette

| Champ                 | Type               | Description                                      |
|-----------------------|--------------------|--------------------------------------------------|
| id                    | AutoField          | Clé primaire (créée automatiquement par Django)  |
| producteur            | ForeignKey         | Lien vers Producteur (1 → N), nullable si supprimé |
| producteur_nom_archive| CharField(100)     | Nom archivé quand le producteur est supprimé    |
| date_cueil            | DateField          | Date de la cueillette                            |
| qte_total             | FloatField         | Quantité totale récoltée (kg)                    |
| qte_bon               | FloatField         | Quantité de bonne qualité (kg)                   |
| qte_mauvais           | FloatField         | Calculé auto : qte_total - qte_bon (kg)         |
| observation           | TextField          | Remarque (optionnel)                             |

**Champs calculés automatiquement (non stockés ou auto-calculés) :**
- `qte_mauvais` = qte_total - qte_bon (calculé dans la méthode `save()`)
- `taux_qualite` = (qte_bon / qte_total) * 100 (calculé via `@property`, non stocké en base)

**Tri par défaut :** date de cueillette la plus récente en premier (`ordering = ['-date_cueil']`)

### 3.3 — Relation entre les modèles

```
Producteur (1) ──────→ (0..*) Cueillette
```

- Un producteur peut avoir **plusieurs** cueillettes
- Une cueillette appartient à **un seul** producteur
- **Règle de suppression modifiée :** si un producteur est supprimé, ses cueillettes **ne sont pas** supprimées. Le nom du producteur est archivé dans `producteur_nom_archive` et le champ `producteur` devient `NULL` (`on_delete=models.SET_NULL`).
- Chemin inverse : `producteur.cueillettes.all()` (grâce à `related_name='cueillettes'`)

### 3.4 — Changements récents (archivage)

| Élément | Description |
|---------|-------------|
| `producteur` (Cueillette) | `on_delete=models.SET_NULL` au lieu de `CASCADE` — les cueillettes restent si le producteur est supprimé |
| `producteur_nom_archive` | Nouveau champ : stocke le nom du producteur avant suppression pour l'affichage |
| `get_producteur_display()` | Méthode : affiche le nom du producteur ou `"{nom_archive} (supprimé)"` si le producteur a été supprimé |

---

## 4. Validations

### Dans le formulaire (forms.py)
- La quantité bonne (`qte_bon`) ne peut pas dépasser la quantité totale (`qte_total`)
- Les quantités ne peuvent pas être négatives

### Dans le modèle (models.py)
- `qte_mauvais` est recalculé automatiquement à chaque sauvegarde via `save()`
- `taux_qualite` est recalculé à chaque accès via `@property`

---

## 5. URLs

### Producteur

| URL                                  | Vue                    | Nom                    | Action              |
|--------------------------------------|------------------------|------------------------|---------------------|
| `/producteurs/`                      | liste_producteurs      | liste_producteurs      | Lister tous          |
| `/producteurs/ajouter/`             | ajouter_producteur     | ajouter_producteur     | Formulaire d'ajout   |
| `/producteurs/modifier/<int:pk>/`   | modifier_producteur    | modifier_producteur    | Formulaire de modif  |
| `/producteurs/supprimer/<int:pk>/`  | supprimer_producteur   | supprimer_producteur   | Confirmation suppression |

### Cueillette

| URL                                  | Vue                    | Nom                    | Action              |
|--------------------------------------|------------------------|------------------------|---------------------|
| `/cueillettes/`                      | liste_cueillettes      | liste_cueillettes      | Lister toutes        |
| `/cueillettes/ajouter/`             | ajouter_cueillette     | ajouter_cueillette     | Formulaire d'ajout   |
| `/cueillettes/modifier/<int:pk>/`   | modifier_cueillette    | modifier_cueillette    | Formulaire de modif  |
| `/cueillettes/supprimer/<int:pk>/`  | supprimer_cueillette   | supprimer_cueillette   | Confirmation suppression |

---

## 6. Vues (views.py)

Chaque modèle dispose de 4 vues (CRUD complet) :

| Vue                  | Méthode HTTP | Description                                |
|----------------------|--------------|--------------------------------------------|
| liste_producteurs    | GET          | Affiche tous les producteurs               |
| ajouter_producteur   | GET / POST   | Affiche le formulaire / Enregistre         |
| modifier_producteur  | GET / POST   | Affiche le formulaire pré-rempli / Modifie |
| supprimer_producteur | GET / POST   | Affiche la confirmation / Supprime         |
| liste_cueillettes    | GET          | Affiche toutes les cueillettes             |
| ajouter_cueillette   | GET / POST   | Affiche le formulaire / Enregistre         |
| modifier_cueillette  | GET / POST   | Affiche le formulaire pré-rempli / Modifie |
| supprimer_cueillette | GET / POST   | Affiche la confirmation / Supprime         |

---

## 7. Admin Django

L'administration Django est configurée dans `admin.py` pour les deux modèles :

### ProducteurAdmin
- **Colonnes affichées :** nom_complet, zone, contact, actif, date_creation
- **Recherche :** par nom, zone, contact
- **Filtres :** par zone, par statut actif
- **Édition rapide :** le champ actif est modifiable directement dans la liste

### CueilletteAdmin
- **Colonnes affichées :** get_producteur_display, date_cueil, qte_total, qte_bon, qte_mauvais, taux_qualite
- **Recherche :** par nom du producteur et producteur_nom_archive
- **Filtres :** par date de cueillette
- **Taux qualité :** affiché via une méthode personnalisée `get_taux_qualite`

---

## 8. Templates (HTML)

Tous les templates héritent de `base.html` qui contient :
- Une barre de navigation (Producteurs, Cueillettes, Admin)
- Un CSS moderne avec thème orange
- Un pied de page

### Fonctionnalités spéciales
- **Liste producteurs :** badges colorés pour le statut (Actif = vert, Inactif = rouge)
- **Liste cueillettes :** badges colorés pour le taux de qualité (>= 80% = vert, >= 50% = jaune, < 50% = rouge)
- **Formulaire cueillette :** calcul JavaScript en direct qui affiche la quantité mauvaise et le taux de qualité pendant la saisie

---

## 9. Configuration du projet

### settings.py (modifications effectuées)
- `'recolte.apps.RecolteConfig'` dans `INSTALLED_APPS` (charge les signaux via `ready()`)
- `'DIRS': [BASE_DIR / 'templates']` ajouté dans `TEMPLATES`

### JusOrange/urls.py
- `path('', include('recolte.urls'))` ajouté pour brancher les URLs du module

---

## 10. Commandes utilisées

```bash
# Créer l'app
python manage.py startapp recolte

# Créer les migrations
python manage.py makemigrations

# Appliquer les migrations
python manage.py migrate

# Créer un superutilisateur
python manage.py createsuperuser

# Lancer le serveur
python manage.py runserver

# Remplir avec des données fictives (commande personnalisée)
python manage.py populate_sample
```

---

## 11. Signaux (signals.py)

Avant la suppression d'un **Producteur**, le signal `pre_delete` :
1. Enregistre le nom du producteur dans `producteur_nom_archive` pour chaque cueillette liée
2. Django applique ensuite `SET_NULL` sur le champ `producteur` des cueillettes

Résultat : les cueillettes restent en base et affichent « Nom (supprimé) » via `get_producteur_display()`.

## 12. Liens avec les autres modules

Le modèle **Cueillette** est lié au module **Appro** (Réception) :
```
Cueillette (1) ──────→ (1..*) Reception
```

Le modèle **Producteur** peut être importé par les autres modules :
```python
from recolte.models import Producteur
```

**Voir aussi :** [DocuAppro](DocuAppro.md), [DocuFabrication](DocuFabrication.md), [DocuEmballage](DocuEmballage.md), [DocuDistribution](DocuDistribution.md), [DocuEntrepot](DocuEntrepot.md).

---

## 13. Résumé technique

| Élément               | Valeur                    |
|-----------------------|---------------------------|
| Nom de l'app          | recolte                   |
| Nombre de modèles     | 2 (Producteur, Cueillette)|
| Nombre de vues        | 8 (4 par modèle)          |
| Nombre de URLs        | 8                          |
| Nombre de templates   | 7 (1 base + 6 pages)      |
| Nombre de formulaires | 2                          |
| Type de relation      | ForeignKey (1 → N)         |
| Base de données       | MySQL / MariaDB (jusorange) |
| Framework             | Django 4.2 (compatible MariaDB 10.4) |
