# Documentation — Module Distribution
## Projet JusOrange GDA

---

## 1. Présentation du module

Le module **Distribution** gère la vente et la facturation des jus d'orange :
- La gestion des **Clients** (acheteurs)
- Les **Commandes** (demandes de quantités 33cl et 1L, en attente ou complétées)
- Les **Ventes** (transactions créées lors de la complétion d'une commande)
- Les **Factures** (créées automatiquement à chaque complétion)
- Les **Paiements** (enregistrés depuis le détail vente uniquement)
- La **Trésorerie** (réception paiement côté trésorier, comparaison commercial vs trésorier, gestion des écarts)

Le flux principal : **Client → Commande** → bouton « Compléter commande » → **Vente + Facture** (+ Paiement si payée ou partielle). Les prix sont paramétrés dans le module Appro (ArticleStock : jus_33cl, jus_1l).

Ce module est contenu dans l'app Django **`distribution`**.

---

## 2. Structure des fichiers

```
distribution/
├── models.py          → Modèles (Client, Vente, Commande, Facture, Paiement, ReceptionPaiement)
├── admin.py           → Configuration de l'admin Django
├── forms.py           → Formulaires (Client, Vente, Commande, Facture, Paiement, CompleterCommande, PaiementFacture, ReceptionPaiement, GererEcart, ReceptionPaiementModifier)
├── views.py           → Vues (CRUD Clients, Ventes, Commandes, Factures, Paiements + compléter commande)
├── urls.py            → URLs du module
├── apps.py            → Configuration de l'app
├── tests.py           → Tests unitaires (modèles, formulaires)
└── migrations/
    └── 0001_initial.py → Migration unique

templates/
└── distribution/
    ├── liste_clients.html
    ├── form_client.html
    ├── confirmer_suppression_client.html
    ├── liste_ventes.html
    ├── detail_vente.html
    ├── form_vente.html
    ├── confirmer_suppression_vente.html
    ├── liste_commandes.html
    ├── form_commande.html
    ├── confirmer_completer_commande.html
    ├── confirmer_suppression_commande.html
    ├── liste_factures.html
    ├── form_facture.html
    ├── confirmer_suppression_facture.html
    ├── liste_paiements.html
    ├── form_paiement.html
    ├── form_paiement_facture.html
    ├── confirmer_suppression_paiement.html
    ├── liste_tresorerie.html
    ├── form_reception_paiement.html
    ├── form_modifier_reception.html
    └── form_gerer_ecart.html
```

---

## 3. Modèles de données

### 3.1 — Client

| Champ        | Type               | Description                                      |
|--------------|--------------------|--------------------------------------------------|
| id           | AutoField          | Clé primaire                                     |
| nom_complet  | CharField(200)     | Nom complet du client                            |
| tel_client   | CharField(30)      | Téléphone (optionnel mais au moins tel ou email) |
| email        | EmailField         | Email (optionnel)                                |
| adresse      | TextField          | Adresse (optionnel)                              |

**Validation :** au moins un de `tel_client` ou `email` doit être renseigné.

### 3.2 — Vente

| Champ             | Type               | Description                                      |
|-------------------|--------------------|--------------------------------------------------|
| id                | AutoField          | Clé primaire                                     |
| client            | ForeignKey         | Client acheteur — CASCADE                        |
| date_vente        | DateField          | Date de la vente                                 |
| montant_total     | FloatField         | Montant total (XOF)                             |
| statut_paiement   | CharField(20)      | ACHAT_VENTE, PARTIELLE, DEPOT_VENTE              |

**Statuts :** ACHAT_VENTE (Achat-vente), PARTIELLE (Partielle), DEPOT_VENTE (Dépôt-vente)

### 3.3 — Commande

| Champ         | Type               | Description                                      |
|---------------|--------------------|--------------------------------------------------|
| id            | AutoField          | Clé primaire                                     |
| client        | ForeignKey         | Client — CASCADE                                 |
| vente         | ForeignKey         | Vente (null si non encore complétée) — SET_NULL  |
| date_cmd      | DateField          | Date commande (défaut = aujourd'hui)             |
| quantite_33cl | IntegerField       | Quantité 33cl (au moins une qté > 0)             |
| quantite_1l   | IntegerField       | Quantité 1L                                      |

**Méthode :** `get_total_ligne()` → calcule le total à partir des prix ArticleStock (jus_33cl, jus_1l).

**Règles :** au moins `quantite_33cl` ou `quantite_1l` > 0. La vente est créée lors du clic « Compléter commande ».

### 3.4 — Facture

| Champ         | Type               | Description                                      |
|---------------|--------------------|--------------------------------------------------|
| id            | AutoField          | Clé primaire                                     |
| vente         | ForeignKey         | Vente — CASCADE                                  |
| num_fact      | CharField(50)      | N° facture auto : FACT00110022026, FACT002...    |
| date_fact     | DateField          | Date facture                                     |
| montant       | FloatField         | Montant (XOF)                                   |
| statut        | CharField(20)      | EMIS, ACHAT_VENTE, PARTIELLE, ANNULEE            |
| date_echeance | DateField          | Date d'échéance                                  |

**Champs calculés :** `num_fact` = FACT00110022026 (séquentiel par date).

### 3.5 — Paiement

| Champ       | Type               | Description                                      |
|-------------|--------------------|--------------------------------------------------|
| id          | AutoField          | Clé primaire                                     |
| facture     | ForeignKey         | Facture — CASCADE                                |
| date_paie   | DateField          | Date du paiement                                 |
| montant     | FloatField         | Montant (XOF)                                   |
| mode_paie   | CharField(20)      | ESPECE, CHEQUE, VIREMENT, MOBILE                 |
| reference   | CharField(100)     | Référence (chèque, virement...) — optionnel      |

**Modes :** ESPECE, CHEQUE, VIREMENT, MOBILE.

### 3.6 — ReceptionPaiement (trésorerie)

| Champ         | Type               | Description                                      |
|---------------|--------------------|--------------------------------------------------|
| id            | AutoField          | Clé primaire                                     |
| paiement      | OneToOneField      | Paiement (commercial) — CASCADE                  |
| montant_recu  | FloatField         | Montant effectivement reçu par le trésorier      |
| date_reception| DateField          | Date de réception                                |
| observation   | TextField          | Gestion des écarts (optionnel)                   |
| ecart_traite  | BooleanField       | Écart traité (défaut : False)                    |

**Propriétés calculées :** `ecart` = montant_recu - paiement.montant ; `statut_reception` = CONFORME, ECART_POSITIF ou ECART_NEGATIF.

### 3.7 — Relations entre les modèles

```
Client (1) ──────────────→ (0..*) Commande
Client (1) ──────────────→ (0..*) Vente
Vente (1) ───────────────→ (0..*) Commande (via SET_NULL)
Vente (1) ───────────────→ (1..*) Facture
Facture (1) ─────────────→ (0..*) Paiement
Paiement (1) ←──OneToOne──→ (0..1) ReceptionPaiement (trésorerie)
Bouteille (0..*) ─────────→ (1) Commande (module emballage)
```

- Une commande est liée à un client ; elle peut être en attente (`vente` null) ou complétée (`vente` non null)
- À la complétion : création de Vente + Facture (+ Paiement si payée ou partielle)
- Les bouteilles assignées à une commande passent en statut VENDUE (module emballage)

---

## 4. Logique métier

### 4.1 — Flux principal : Commande → Vente

| Étape | Action              | Résultat                                              |
|-------|---------------------|--------------------------------------------------------|
| 1     | Ajouter une commande| Client + quantités 33cl/1L ; vente = null             |
| 2     | Compléter commande  | Vente + Facture créées ; bouteilles assignées (VENDUE)  |
| 3     | Paiement            | Via détail vente : « Enregistrer un paiement »         |

### 4.2 — Compléter une commande

1. **Vérifications préalables :**
   - Prix Jus 33cl et Jus 1L paramétrés dans Articles (module Appro)
   - Stock bouteilles DISPO suffisant (33cl et 1L)

2. **Choix du statut de paiement :**
   - **DETTE** : aucune création de paiement
   - **PARTIELLE** : montant payé obligatoire ; création d’un paiement
   - **PAYEE** : paiement total créé automatiquement (ESPECE)

3. **Actions effectuées :**
   - Création de la Vente
   - Liaison Commande.vente
   - Création de la Facture (statut cohérent : EMIS, PARTIELLE ou ACHAT_VENTE)
   - Création du Paiement si ACHAT_VENTE ou PARTIELLE
   - Assignation des bouteilles DISPO → statut VENDUE, commande = cette commande
   - Mise à jour du stock jus (maj_stock_jus)

### 4.3 — Enregistrer un paiement

- **Où ?** Depuis le détail d’une vente, pour une facture avec reste à payer.
- **Pas de bouton « Ajouter paiement »** dans la liste des paiements ; les paiements sont saisis uniquement depuis le détail vente.
- **Validation :** montant ≤ reste à payer.
- **Mise à jour des statuts :** facture ACHAT_VENTE ou PARTIELLE ; vente ACHAT_VENTE ou PARTIELLE.

### 4.4 — Prix

- **33cl :** ArticleStock `jus_33cl.prix_33cl` (ex. 750 XOF)
- **1L :** ArticleStock `jus_1l.prix_1l` (ex. 2500 XOF)
- Paramétrage dans Articles > Paramétrer Jus 33cl / Paramétrer Jus 1L.

### 4.5 — Trésorerie (réception paiement, comparaison, écarts)

Le module trésorerie permet au financier de :
- **Ajouter une réception paiement** : enregistrer le montant effectivement reçu pour un paiement déclaré par le commercial
- **Comparer** : vue comparative automatique (montant commercial vs montant reçu)
- **Gérer les écarts** : pour chaque écart (positif ou négatif), ajouter une observation et marquer comme traité

**Modèle ReceptionPaiement :** lié à Paiement (OneToOne). Champs : montant_recu, date_reception, observation, ecart_traite. L'écart et le statut (CONFORME, ECART_POSITIF, ECART_NEGATIF) sont calculés automatiquement.

### 4.6 — Format num_fact

- Format : `FACT00110022026`, `FACT00210022026`, etc.
- `FACT001`, `FACT002` : numéro séquentiel par date
- `10022026` : date (JJMMAAAA)

---

## 5. URLs

### Clients

| URL                                  | Vue                 | Action                      |
|--------------------------------------|---------------------|-----------------------------|
| `/clients/`                          | liste_clients       | Lister tous les clients     |
| `/clients/ajouter/`                  | ajouter_client      | Formulaire d'ajout          |
| `/clients/modifier/<int:pk>/`        | modifier_client     | Formulaire de modification  |
| `/clients/supprimer/<int:pk>/`       | supprimer_client    | Confirmation suppression     |

### Ventes

| URL                                  | Vue                 | Action                      |
|--------------------------------------|---------------------|-----------------------------|
| `/ventes/`                            | liste_ventes        | Lister les ventes (?statut=) |
| `/ventes/<int:pk>/`                   | detail_vente        | Détail vente + paiements    |
| `/ventes/ajouter/`                   | ajouter_vente       | Formulaire d'ajout          |
| `/ventes/modifier/<int:pk>/`          | modifier_vente     | Formulaire de modification  |
| `/ventes/supprimer/<int:pk>/`         | supprimer_vente     | Confirmation suppression     |

### Commandes

| URL                                  | Vue                 | Action                      |
|--------------------------------------|---------------------|-----------------------------|
| `/commandes/`                         | liste_commandes     | Lister les commandes        |
| `/commandes/ajouter/`                | ajouter_commande    | Formulaire d'ajout          |
| `/commandes/<int:pk>/completer/`     | completer_commande   | Compléter → Vente + Facture |
| `/commandes/modifier/<int:pk>/`       | modifier_commande   | Formulaire de modification  |
| `/commandes/supprimer/<int:pk>/`      | supprimer_commande   | Confirmation suppression     |

### Factures

| URL                                  | Vue                 | Action                      |
|--------------------------------------|---------------------|-----------------------------|
| `/factures/`                          | liste_factures      | Lister les factures (?statut=) |
| `/factures/ajouter/`                 | ajouter_facture     | Formulaire d'ajout          |
| `/factures/modifier/<int:pk>/`        | modifier_facture   | Formulaire de modification  |
| `/factures/supprimer/<int:pk>/`       | supprimer_facture   | Confirmation suppression     |

### Paiements

| URL                                  | Vue                    | Action                      |
|--------------------------------------|------------------------|-----------------------------|
| `/paiements/`                         | liste_paiements        | Lister tous les paiements   |
| `/factures/<int:facture_pk>/paiement/`| ajouter_paiement_facture| Enregistrer un paiement     |
| `/paiements/modifier/<int:pk>/`        | modifier_paiement     | Formulaire de modification  |
| `/paiements/supprimer/<int:pk>/`      | supprimer_paiement     | Confirmation suppression     |

### Trésorerie

| URL                                  | Vue                    | Action                      |
|--------------------------------------|------------------------|-----------------------------|
| `/tresorerie/`                        | liste_tresorerie       | Comparaison commercial / trésorier |
| `/tresorerie/reception/ajouter/`     | ajouter_reception_paiement | Ajouter réception paiement |
| `/tresorerie/ecart/<int:pk>/`         | gerer_ecart            | Gérer un écart              |

---

## 6. Formulaires

### ClientForm

- **Champs :** nom_complet, tel_client, email, adresse
- **Validation :** au moins tel ou email renseigné

### VenteForm

- **Champs :** client, date_vente, montant_total, statut_paiement

### CommandeForm

- **Champs :** client, date_cmd, quantite_33cl, quantite_1l
- **Validation :** au moins une quantité > 0
- **Valeur par défaut :** date_cmd = aujourd'hui

### CompleterCommandeForm

- **Champs :** statut_paiement (DEPOT_VENTE, PARTIELLE, ACHAT_VENTE), montant_paye (si PARTIELLE)
- **Validation :** si PARTIELLE, montant_paye obligatoire et < montant_total

### FactureForm

- **Champs :** vente, date_fact, montant, statut, date_echeance

### PaiementForm

- **Champs :** facture, date_paie, montant, mode_paie, reference

### PaiementFactureForm

- **Champs :** date_paie, montant, mode_paie, reference (utilisé depuis détail vente)
- **Validation :** montant > 0 et ≤ reste à payer

### ReceptionPaiementForm

- **Champs :** paiement, montant_recu, date_reception, observation
- **Utilisé pour :** enregistrer une réception paiement côté trésorier
- **Filtre :** uniquement les paiements sans réception existante

### GererEcartForm

- **Champs :** observation, ecart_traite
- **Utilisé pour :** gérer un écart (justification, marquer comme traité)

---

## 7. Vues (views.py)

| Vue                    | Méthode HTTP | Description                                |
|------------------------|--------------|--------------------------------------------|
| liste_clients          | GET          | Liste des clients                          |
| ajouter_client         | GET / POST   | Ajouter un client                          |
| modifier_client        | GET / POST   | Modifier un client                          |
| supprimer_client       | GET / POST   | Supprimer un client                        |
| liste_ventes           | GET          | Liste des ventes (filtre statut)           |
| detail_vente           | GET          | Détail vente + factures + paiements        |
| ajouter_vente          | GET / POST   | Ajouter une vente (manuel)                 |
| modifier_vente         | GET / POST   | Modifier une vente                         |
| supprimer_vente        | GET / POST   | Supprimer une vente                        |
| liste_commandes        | GET          | Liste des commandes                        |
| ajouter_commande       | GET / POST   | Ajouter une commande                       |
| completer_commande     | GET / POST   | Compléter commande → Vente + Facture       |
| modifier_commande      | GET / POST   | Modifier une commande                       |
| supprimer_commande     | GET / POST   | Supprimer une commande                      |
| liste_factures         | GET          | Liste des factures (filtre statut)         |
| ajouter_facture        | GET / POST   | Ajouter une facture (manuel)               |
| modifier_facture       | GET / POST   | Modifier une facture                        |
| supprimer_facture      | GET / POST   | Supprimer une facture                       |
| liste_paiements        | GET          | Liste des paiements                        |
| ajouter_paiement_facture | GET / POST | Enregistrer un paiement (depuis détail vente) |
| modifier_paiement      | GET / POST   | Modifier un paiement                        |
| supprimer_paiement     | GET / POST   | Supprimer un paiement                       |
| liste_tresorerie       | GET          | Comparaison commercial / trésorier          |
| ajouter_reception_paiement | GET / POST | Ajouter réception paiement (trésorerie)      |
| gerer_ecart            | GET / POST   | Gérer un écart de paiement                  |

---

## 8. Admin Django

### ClientAdmin

- **Colonnes :** nom_complet, tel_client, email, adresse
- **Recherche :** nom_complet, tel_client, email

### VenteAdmin

- **Colonnes :** id, client, date_vente, montant_total, statut_paiement
- **Filtres :** statut_paiement, date_vente
- **Inlines :** CommandeInline, FactureInline

### CommandeAdmin

- **Colonnes :** id, date_cmd, client, quantite_33cl, quantite_1l, vente, get_total
- **Filtres :** date_cmd, vente__date_vente

### FactureAdmin

- **Colonnes :** num_fact, vente, date_fact, montant, statut, date_echeance
- **Filtres :** statut, date_fact
- **Inlines :** PaiementInline
- **Lecture seule :** num_fact

### PaiementAdmin

- **Colonnes :** id, facture, date_paie, montant, mode_paie, reference
- **Filtres :** mode_paie, date_paie

### ReceptionPaiementAdmin

- **Colonnes :** id, paiement, montant_recu, date_reception, get_ecart, ecart_traite
- **Filtres :** ecart_traite, date_reception

---

## 9. Configuration du projet

### settings.py

- `'distribution.apps.DistributionConfig'` dans `INSTALLED_APPS`

### JusOrange/urls.py

- `path('', include('distribution.urls'))` pour brancher les URLs du module

---

## 10. Intégration avec les autres modules

| Module    | Lien                                                                 |
|-----------|----------------------------------------------------------------------|
| **appro** | Prix jus (ArticleStock.prix_33cl, prix_1l) utilisés pour le total des commandes |
| **emballage** | Bouteille.commande (FK vers Commande) ; bouteilles DISPO → VENDUE lors de la complétion |

---

## 11. Résumé technique

| Élément               | Valeur                                                       |
|----------------------|--------------------------------------------------------------|
| Nom de l'app         | distribution                                                 |
| Nombre de modèles    | 6 (Client, Vente, Commande, Facture, Paiement, ReceptionPaiement) |
| Nombre de vues       | 22                                                           |
| Nombre de URLs       | 22                                                           |
| Nombre de formulaires| 10 (+ ReceptionPaiement, GererEcart, ReceptionPaiementModifier) |
| Nombre de templates  | 22                                                           |
| Migration            | 1 fichier (0001_initial.py)                                  |
| Dépendances          | appro (ArticleStock pour prix), emballage (Bouteille)         |
| Base de données      | MySQL / MariaDB (jusorange)                                   |
