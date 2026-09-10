# Documentation — Module Fabrication
## Projet JusOrange GDA

---

## 1. Présentation du module

Le module **Fabrication** gère le cycle de vie des **Productions** de jus d'orange :
- La **programmation** d'une production (date + recette)
- La **complétion** des données de fabrication (procédé, ingrédients, contrôle qualité, résultat)
- La **modification** des productions terminées ou annulées
- La **suppression** des productions

Ce module est contenu dans l'app Django **`fabrication`**.

---

## 2. Structure des fichiers

```
fabrication/
├── models.py          → Modèle Production
├── admin.py           → Configuration de l'admin Django
├── forms.py           → Formulaires (Create, Complete, Modifier)
├── views.py           → 6 vues (liste, ajouter, choix, completer, modifier, supprimer)
├── urls.py            → 6 URLs
├── apps.py            → Configuration de l'app
├── tests.py           → Tests unitaires (modèles, formulaires)
└── migrations/
    └── 0001_initial.py → Migration unique (état final du modèle)

templates/
└── fabrication/
    ├── liste_productions.html           → Liste des productions
    ├── form_production.html             → Formulaire programmer (date + recette)
    ├── choix_apres_creation.html         → Choix : Compléter ou Retour liste
    ├── form_completer.html              → Formulaire compléter (4 onglets)
    ├── form_modifier.html               → Formulaire modifier (4 onglets)
    └── confirmer_suppression_production.html
```

---

## 3. Modèle de données

### 3.1 — Production

| Champ               | Type               | Description                                      |
|---------------------|--------------------|--------------------------------------------------|
| id                  | AutoField          | Clé primaire                                     |
| date_of             | DateField          | Date de la production                            |
| numero_of           | CharField(30)      | N° OF auto : OF00112022026, OF002... (éditable=False) |
| lavage_effectue     | BooleanField       | Lavage effectué (Oui/Non)                        |
| filtration_effectuee| BooleanField       | Filtration effectuée (Oui/Non)                   |
| recette             | CharField(20)      | Recette : 80/20 ou 75/25                         |
| eau_ajoutee_l       | FloatField         | Eau ajoutée (litres)                             |
| sucre_ajoute_kg     | FloatField         | Sucre ajouté (kg)                                |
| sorbate_ajoute_g    | FloatField         | Sorbate ajouté (g)                               |
| pasteurisation_80c  | BooleanField       | Pasteurisation 80°C (Oui/Non)                    |
| test_qualite        | CharField(20)      | Test qualité : Conforme / Non conforme (optionnel) |
| ph                  | IntegerField       | pH (entier 0 à 10)                               |
| refractometre        | IntegerField       | Réfractomètre (entier 0 à 20)                    |
| volume_final_l      | FloatField         | Volume final (litres)                             |
| statut_production   | CharField(20)      | Statut : En cours, Terminée, Annulée             |
| user                | ForeignKey(User)   | Responsable (optionnel, nullable)                |

**Champs calculés automatiquement :**
- `numero_of` = OF00112022026, OF002... (numéro séquentiel par date ; reset à OF001 quand la date change)

**Choix :**
- **Recettes :** R80_20 (80/20), R75_25 (75/25)
- **Test qualité :** CONFORME, NON_CONFORME
- **Statut :** EN_COURS, TERMINEE, ANNULLEE

**Validations :**
- `ph` : MinValueValidator(0), MaxValueValidator(10)
- `refractometre` : MinValueValidator(0), MaxValueValidator(20)

**Tri par défaut :** date décroissante (`ordering = ['-date_of']`)

---

## 4. Logique métier

### 4.1 — Flux en deux étapes

| Étape | Action           | Statut résultant | Page suivante                    |
|-------|------------------|------------------|----------------------------------|
| 1     | Programmer       | EN_COURS         | Choix : Compléter ou Retour liste |
| 2     | Compléter        | TERMINEE         | Liste des productions            |

### 4.2 — Actions selon le statut

| Statut     | Actions disponibles                    |
|------------|----------------------------------------|
| En cours   | Compléter, Supprimer                   |
| Terminée   | Modifier, Supprimer                    |
| Annulée    | Modifier, Supprimer                    |

### 4.3 — Format numero_of

- Format : `OF00112022026`, `OF00212022026`, etc.
- `OF001`, `OF002` : numéro séquentiel par date
- `12022026` : date (JJMMAAAA)
- Quand la date change, le numéro repart à OF001

### 4.4 — Formulaires à onglets (Compléter / Modifier)

Les formulaires **Compléter** et **Modifier** sont organisés en 4 onglets :
1. **Procédé** : Lavage, Filtration, Pasteurisation (Oui/Non)
2. **Ingrédients** : Eau (L), Sucre (kg), Sorbate (g)
3. **Contrôle qualité** : Test qualité, pH (0-10), Réfractomètre (0-20)
4. **Résultat** : Volume final (L) — + Statut et Date/Recette pour Modifier

**Validation côté client :**
- Tous les champs obligatoires doivent être remplis avant de passer à l'onglet suivant
- Champs numériques (eau, sucre, sorbate, volume) : valeur > 0
- pH : entier entre 0 et 10
- Réfractomètre : entier entre 0 et 20
- Alerte affichée si champs manquants ou invalides

---

## 5. URLs

| URL                                          | Vue                    | Action                      |
|----------------------------------------------|------------------------|-----------------------------|
| `/productions/`                              | liste_productions      | Lister toutes les productions |
| `/productions/ajouter/`                      | ajouter_production     | Programmer une production   |
| `/productions/<int:pk>/creation-reussie/`   | choix_apres_creation   | Choix : Compléter ou Retour |
| `/productions/<int:pk>/completer/`           | completer_production   | Compléter la production    |
| `/productions/modifier/<int:pk>/`            | modifier_production   | Modifier une production    |
| `/productions/supprimer/<int:pk>/`           | supprimer_production  | Confirmation suppression   |

---

## 6. Formulaires

### ProductionCreateForm
- **Champs :** date_of, recette
- **Utilisé pour :** Programmer une production (étape 1)
- **Statut après enregistrement :** EN_COURS

### ProductionCompleteForm
- **Champs :** lavage_effectue, filtration_effectuee, pasteurisation_80c, eau_ajoutee_l, sucre_ajoute_kg, sorbate_ajoute_g, test_qualite, ph, refractometre, volume_final_l
- **Exclus :** date_of, recette, numero_of, statut_production, user
- **Validation :** pH (0-10), réfractomètre (0-20), champs numériques > 0
- **Champs vides par défaut :** eau, sucre, sorbate, volume (placeholder uniquement)
- **Statut après enregistrement :** TERMINEE

### ProductionModifierForm
- **Champs :** date_of, recette, lavage_effectue, filtration_effectuee, pasteurisation_80c, eau_ajoutee_l, sucre_ajoute_kg, sorbate_ajoute_g, test_qualite, ph, refractometre, volume_final_l, statut_production
- **Exclus :** numero_of, user
- **Même validation** que ProductionCompleteForm

---

## 7. Vues (views.py)

| Vue                   | Méthode HTTP | Description                                |
|-----------------------|--------------|--------------------------------------------|
| liste_productions     | GET          | Affiche toutes les productions            |
| ajouter_production    | GET / POST   | Programmer (date + recette) → statut EN_COURS |
| choix_apres_creation | GET          | Choix : Compléter ou Retour liste          |
| completer_production  | GET / POST   | Compléter → statut TERMINEE                 |
| modifier_production   | GET / POST   | Modifier une production existante          |
| supprimer_production  | GET / POST   | Confirmation puis suppression              |

---

## 8. Admin Django

### ProductionAdmin
- **Colonnes :** numero_of, date_of, recette, statut_production, volume_final_l, test_qualite, user
- **Recherche :** numero_of
- **Filtres :** statut_production, recette, date_of
- **Édition rapide :** statut_production
- **Champs en lecture seule :** numero_of
- **Fieldsets :** Identification, Procédé, Ingrédients, Contrôle qualité, Résultat

---

## 9. Templates (HTML)

Tous les templates héritent de `base.html` (navigation, thème orange).

### Fonctionnalités spéciales
- **Liste productions :** badges colorés pour le statut (Terminée = vert, En cours = jaune, Annulée = gris)
- **Formulaires Compléter / Modifier :** 4 onglets Bootstrap, validation JavaScript par onglet, placeholders pour champs numériques
- **Champs vides :** script JS vide les champs affichant 0 pour ne montrer que le placeholder

---

## 10. Configuration du projet

### settings.py
- `'fabrication.apps.FabricationConfig'` dans `INSTALLED_APPS`

### JusOrange/urls.py
- `path('', include('fabrication.urls'))` pour brancher les URLs du module

---

## 11. Résumé technique

| Élément               | Valeur                        |
|-----------------------|-------------------------------|
| Nom de l'app          | fabrication                   |
| Nombre de modèles     | 1 (Production)                |
| Nombre de vues        | 6                             |
| Nombre de URLs        | 6                             |
| Nombre de formulaires | 3 (Create, Complete, Modifier)|
| Nombre de templates   | 6                             |
| Migration             | 1 fichier (0001_initial.py)   |
| Dépendance            | django.contrib.auth (User)    |
| Base de données       | MySQL / MariaDB (jusorange)   |
