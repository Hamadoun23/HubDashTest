# Documentation — Base de données MySQL / MariaDB
## Projet JusOrange GDA

---

## 1. Qu'est-ce que MySQL / MariaDB ?

**MySQL** et **MariaDB** sont des moteurs de base de données relationnelles **client-serveur** : un serveur (processus) gère les données, les applications s'y connectent via un client.

JusOrange GDA utilise **MySQL** ou **MariaDB** (compatible MySQL), typiquement via **XAMPP** en local ou un serveur MySQL/MariaDB en production.

### Caractéristiques principales

| Aspect | Description |
|--------|-------------|
| **Serveur** | Processus MySQL/MariaDB à lancer (ex: via XAMPP) |
| **Bases multiples** | Plusieurs bases de données sur le même serveur |
| **Concurrence** | Gestion avancée des écritures simultanées |
| **ACID** | Transactions fiables |
| **Production** | Adapté aux déploiements réels |

### ACID expliqué en détail

**ACID** garantit que les opérations sur la base sont **fiables** même en cas d'erreur ou de concurrence.

#### A — Atomicité (All or Nothing)

**Idée :** Une transaction est un bloc indivisible. Soit **toutes** les opérations réussissent, soit **aucune** n'est appliquée.

**Exemple concret (JusOrange) :**  
Quand vous créez une réception, la base doit :
1. Insérer la réception
2. Mettre à jour le stock d'oranges

Si l'étape 2 échoue (panne, erreur), l'étape 1 est **annulée**. On évite une réception enregistrée sans mise à jour du stock.

**Sans atomicité :** on pourrait avoir une réception sans stock mis à jour → données incohérentes.  
**Avec atomicité :** soit tout est fait, soit rien n'est fait.

---

#### C — Cohérence

**Idée :** Après chaque transaction, la base respecte toutes les règles définies (contraintes, clés étrangères, etc.).

**Exemple :** Une cueillette ne peut pas avoir `qte_bon > qte_total`. Si une transaction viole cette règle, elle est refusée.

---

#### I — Isolation

**Idée :** Les transactions qui s'exécutent en parallèle ne se gênent pas. Chaque transaction voit la base comme si elle était seule.

**Exemple concret :**  
- **Utilisateur A** modifie la production OF001  
- **Utilisateur B** consulte la liste des productions en même temps  

**Sans isolation :** B pourrait voir des données à moitié modifiées (ex. ancien volume + nouvelle date).  
**Avec isolation :** B voit soit l'ancien état complet, soit le nouveau. Pas de mélange.

---

#### D — Durabilité

**Idée :** Une fois une transaction validée (commit), elle est **définitive**. Une panne électrique ne fait pas disparaître les données.

**Exemple :** Vous enregistrez une production. Une seconde après, l'ordinateur s'éteint. Au redémarrage, la production est toujours là.

---

### Avantages pour JusOrange GDA

- **Production** : adapté au déploiement réel
- **Concurrence** : plusieurs utilisateurs simultanés
- **Outils** : phpMyAdmin (XAMPP), MySQL Workbench
- **Backup** : `mysqldump` pour sauvegardes complètes

### Versions supportées

- **Django 4.2** : MySQL 5.7+, MariaDB 10.4+
- **Django 6.0** : MySQL 8.0+, MariaDB 10.6+

---

## 2. Configuration dans Django

### 2.1 — Dépendances Python

Dans `requirements.txt` :

```
Django>=4.2,<5.0
PyMySQL>=1.1.0
```

**PyMySQL** est utilisé comme driver MySQL (compatible avec `mysqlclient`).

### 2.2 — Configuration PyMySQL

Dans `JusOrange/__init__.py` (chargé avant Django) :

```python
import pymysql
pymysql.install_as_MySQLdb()
# Django exige mysqlclient 2.2.1+ ; PyMySQL fonctionne mais signale 1.4.6
pymysql.version_info = (2, 2, 1, "final", 0)
```

### 2.3 — Fichier de configuration

Dans `JusOrange/settings.py` :

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'jusorange',
        'USER': 'root',
        'PASSWORD': '',  # vide par défaut dans XAMPP
        'HOST': 'localhost',
        'PORT': '3306',
        'OPTIONS': {
            'charset': 'utf8mb4',
        }
    }
}
```

- **ENGINE** : moteur MySQL de Django
- **NAME** : nom de la base de données
- **USER** : utilisateur MySQL (ex: `root` pour XAMPP)
- **PASSWORD** : mot de passe (vide par défaut dans XAMPP)
- **HOST** : `localhost` ou adresse du serveur
- **PORT** : `3306` (port par défaut MySQL)
- **OPTIONS** : `charset` utf8mb4 pour les accents et caractères spéciaux

### 2.4 — Créer la base de données

Avant le premier `migrate`, créer la base dans MySQL :

**Via phpMyAdmin** (`http://localhost/phpmyadmin`) :
- Créer une base nommée `jusorange`
- Interclassement : `utf8mb4_unicode_ci`

**Via ligne de commande :**

```bash
cd C:\xampp\mysql\bin
mysql -u root -e "CREATE DATABASE jusorange CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2.5 — Structure du projet

```
OrangeGda/
├── JusOrange/
│   ├── __init__.py     ← Configuration PyMySQL
│   └── settings.py    ← Configuration DATABASES
├── recolte/
├── appro/
├── fabrication/
├── requirements.txt    ← PyMySQL
└── manage.py
```

---

## 3. Structure des données (schéma)

### 3.1 — Tables créées par Django

Lors du premier `migrate`, Django crée notamment :

| Table | Rôle |
|-------|------|
| `django_migrations` | Historique des migrations appliquées |
| `django_content_type` | Types de contenu (pour les permissions) |
| `auth_user` | Utilisateurs Django |
| `auth_group`, `auth_permission` | Groupes et permissions |
| `recolte_producteur` | Producteurs |
| `recolte_cueillette` | Cueillettes |
| `appro_articlestock` | Articles en stock |
| `appro_reception` | Réceptions |
| `fabrication_production` | Productions |
| `emballage_conditionnement` | Conditionnements |
| `emballage_bouteille` | Bouteilles (jus conditionné) |
| `distribution_client` | Clients |
| `distribution_vente` | Ventes |
| `distribution_commande` | Commandes |
| `distribution_facture` | Factures |
| `distribution_paiement` | Paiements |
| `distribution_receptionpaiement` | Réceptions trésorerie |
| `entrepot_inventaire` | Inventaires |
| `django_session` | Sessions utilisateur |
| `django_admin_log` | Logs de l'admin |

### 3.2 — Conventions de nommage

- **Table** : `{app_label}_{nom_modele}` en minuscules (ex: `recolte_producteur`)
- **Colonne** : nom du champ en minuscules avec underscores (ex: `date_cueil`)
- **Clé étrangère** : `{champ}_id` (ex: `producteur_id`)

### 3.3 — Inspecter la base

```bash
# Shell Django (accès à la base via ORM)
python manage.py dbshell

# Dans le shell MySQL :
USE jusorange;
SHOW TABLES;
DESCRIBE recolte_producteur;
SELECT * FROM recolte_producteur LIMIT 5;
EXIT;
```

**Ou via phpMyAdmin** : `http://localhost/phpmyadmin` → sélectionner la base `jusorange`

---

## 4. Migrations : ne pas perdre ses données

### 4.1 — Principe des migrations Django

Les migrations Django modifient le **schéma** (structure des tables) sans supprimer les données, quand c'est possible.

**Règles à respecter :**

1. **Ne jamais modifier manuellement** un fichier de migration déjà appliqué
2. **Toujours créer** de nouvelles migrations pour les changements de modèle
3. **Tester** sur une copie de la base avant de migrer en production

### 4.2 — Types de modifications et impact sur les données

| Modification | Perte de données ? | Remarque |
|--------------|--------------------|----------|
| Ajouter un champ (sans default) | Non* | *Si `null=True` ou `default` fourni |
| Ajouter un champ avec `default` | Non | Les lignes existantes reçoivent la valeur par défaut |
| Supprimer un champ | **Oui** | Les données du champ sont perdues |
| Renommer un champ | **Oui** si mal fait | Utiliser `RenameField` dans la migration |
| Changer le type d'un champ | Parfois | Ex: FloatField → IntegerField peut tronquer |
| Supprimer une table | **Oui** | Toutes les données de la table sont perdues |

### 4.3 — Bonnes pratiques pour préserver les données

**1. Toujours fournir une valeur par défaut ou `null=True` pour les nouveaux champs :**

```python
# Bon : pas de perte
nouveau_champ = models.CharField(max_length=50, default='', blank=True)

# Risqué : Django demandera une valeur pour les lignes existantes
nouveau_champ = models.CharField(max_length=50)  # Obligatoire
```

**2. Renommer un champ avec `RenameField` :**

```python
migrations.RenameField(
    model_name='production',
    old_name='ancien_nom',
    new_name='nouveau_nom',
),
```

**3. Annuler une migration (rollback) :**

```bash
python manage.py migrate fabrication 0001_initial
```

### 4.4 — Réinitialiser la base (perte totale)

Si vous acceptez de tout effacer :

```bash
# 1. Supprimer et recréer la base (via mysql)
mysql -u root -e "DROP DATABASE IF EXISTS jusorange; CREATE DATABASE jusorange CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Réappliquer toutes les migrations
python manage.py migrate

# 3. Remplir avec données de démonstration
python manage.py populate_sample
```

---

## 5. Import / Export des données

### 5.1 — Export : dumpdata (recommandé)

Exporte les données au format JSON :

```bash
# Exporter TOUTES les données (sauf sessions/admin logs)
python manage.py dumpdata --natural-foreign --natural-primary \
    -e contenttypes -e auth.Permission -e sessions.Session -e admin.LogEntry \
    -o backup_complet.json

# Exporter une app spécifique
python manage.py dumpdata recolte -o backup_recolte.json

# Exporter en format lisible
python manage.py dumpdata recolte --indent 2 -o backup_recolte.json
```

### 5.2 — Import : loaddata

```bash
python manage.py loaddata backup_complet.json
python manage.py loaddata backup_recolte.json backup_appro.json
```

### 5.3 — Backup MySQL complet (mysqldump)

Sauvegarde **toutes** les bases du serveur MySQL :

```bash
# Windows (XAMPP)
cd C:\xampp\mysql\bin
mysqldump -u root --all-databases > C:\Users\cisse\backup_mysql_complet.sql

# Avec mot de passe
mysqldump -u root -p --all-databases > backup_mysql_complet.sql
```

Sauvegarde **uniquement** la base jusorange :

```bash
mysqldump -u root jusorange > backup_jusorange.sql
```

### 5.4 — Restaurer un backup MySQL

```bash
cd C:\xampp\mysql\bin

# Restaurer toutes les bases
mysql -u root < C:\Users\cisse\backup_mysql_complet.sql

# Restaurer uniquement jusorange
mysql -u root jusorange < backup_jusorange.sql
```

### 5.5 — Données de démonstration

```bash
python manage.py populate_sample
```

Crée des producteurs, cueillettes, réceptions, productions, clients, ventes, etc.

---

## 6. Résumé des commandes utiles

| Action | Commande |
|--------|----------|
| Créer les tables | `python manage.py migrate` |
| Voir les migrations | `python manage.py showmigrations` |
| Créer une migration | `python manage.py makemigrations` |
| Exporter les données | `python manage.py dumpdata -o backup.json` |
| Importer les données | `python manage.py loaddata backup.json` |
| Shell Django + MySQL | `python manage.py dbshell` |
| Remplir avec données fictives | `python manage.py populate_sample` |
| Backup MySQL complet | `mysqldump -u root --all-databases > backup.sql` |
| Restaurer backup MySQL | `mysql -u root < backup.sql` |

---

## 7. Dépannage courant

### Erreur : "mysqlclient 2.2.1 or newer is required"
- Vérifier que `JusOrange/__init__.py` contient bien `pymysql.version_info = (2, 2, 1, "final", 0)`
- Vérifier que PyMySQL est installé : `pip install PyMySQL`

### Erreur : "Can't connect to MySQL server"
- Démarrer MySQL dans le panneau XAMPP
- Vérifier HOST (`localhost`) et PORT (`3306`)

### Erreur : "Access denied"
- Vérifier USER et PASSWORD dans settings.py
- Par défaut XAMPP : `root` / mot de passe vide

### Erreur : "Unknown database 'jusorange'"
- Créer la base dans phpMyAdmin ou :  
  `mysql -u root -e "CREATE DATABASE jusorange CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`

### Erreur : "MariaDB 10.6 or later is required"
- XAMPP avec MariaDB 10.4 : utiliser Django 4.2 (`pip install "Django>=4.2,<5.0"`)
- Ou mettre à jour XAMPP pour avoir MariaDB 10.6+

### Erreur : "no such table"
- Exécuter : `python manage.py migrate`

---

## 8. Documentation des modules

| Module        | Fichier                 | Description                          |
|---------------|-------------------------|--------------------------------------|
| Récolte       | [DocuRecolte.md](DocuRecolte.md)     | Producteurs, Cueillettes             |
| Appro         | [DocuAppro.md](DocuAppro.md)         | Articles stock, Réceptions           |
| Fabrication   | [DocuFabrication.md](DocuFabrication.md) | Productions                          |
| Emballage     | [DocuEmballage.md](DocuEmballage.md)   | Conditionnements, Bouteilles         |
| Distribution  | [DocuDistribution.md](DocuDistribution.md) | Clients, Ventes, Commandes, Factures, Paiements |
| Entrepot      | [DocuEntrepot.md](DocuEntrepot.md)     | Inventaires                          |
| Reporting     | [DocuReporting.md](DocuReporting.md)   | Dashboard, rapports, exports         |

---

## 9. Références

- [Django Database documentation](https://docs.djangoproject.com/en/stable/ref/databases/)
- [Django MySQL / MariaDB](https://docs.djangoproject.com/en/stable/ref/databases/#mysql-notes)
- [PyMySQL](https://pymysql.readthedocs.io/)
- [Django Migrations](https://docs.djangoproject.com/en/stable/topics/migrations/)
- [dumpdata / loaddata](https://docs.djangoproject.com/en/stable/ref/django-admin/#dumpdata)
