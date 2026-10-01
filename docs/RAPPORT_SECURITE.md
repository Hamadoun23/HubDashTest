# Rapport de sécurité — GDA Hub

*Audit et pentest du 30/09 au 01/10/2026, environnement local (vraies données), référentiel OWASP Top 10 (2021).*

## Synthèse

| | |
|---|---|
| Recette de sécurité automatisée (`scripts/tests/verifier_securite.py`) | **82 / 82** |
| Pentest du contrôle d'accès (`scripts/tests/pentest_acces.py`, vrais comptes) | **43 / 43 attaques refusées** |
| Tests unitaires (identity, FinanceRH, Jus d'orange) | **169 / 169** |
| `npm audit` (interface) | **0 vulnérabilité** |
| `pip-audit` (6 services) | Django, PyJWT, requests corrigés et vérifiés ; urllib3 et pip corrigés à la reconstruction des images |

**25 failles corrigées**, dont 7 critiques ou élevées. Aucune n'est connue comme exploitée.

## Méthode

- **Boîte noire** : attaques à travers la passerelle, comme un navigateur ou un attaquant externe.
- **Boîte grise** : vrais comptes de chaque rôle (salarié, RH, direction, commercial BDM et UBA, partenaire Chantiers, client Planning, admin), données de production chargées en local.
- **Revue de code** ciblée : contrôle d'accès, authentification, téléversements, requêtes sortantes, configuration de production, dépendances.

## Constats et corrections, par catégorie OWASP

### A01 — Contrôle d'accès défaillant

| Constat | Gravité | Correction |
|---|---|---|
| FinanceRH et Jus d'orange acceptaient tout compte du hub ayant un compte local, **sans vérifier l'habilitation** : retirer un accès dans l'administration ne le fermait pas. | Élevée | Habilitation exigée (`accounts/hub.py`, `HABILITATIONS_ADMISES`). |
| Campagnes ouvrait la session d'un compte BDM portant la même adresse qu'un compte du hub, **sans habilitation `campagnes`**. | Élevée | Habilitation exigée (`core/hub.py`). |
| La session Campagnes **ne suivait pas le compte du hub** : après déconnexion d'un admin, un commercial sur le même navigateur héritait de sa session. | Élevée | Session alignée sur le jeton (empreinte), fermée si la personne change. |
| Connexions propres aux applications encore ouvertes (FinanceRH, Jus d'orange, Campagnes, mots de passe oubliés) : portes d'entrée parallèles au hub. | Élevée | Fermées à la passerelle ; jetons/sessions locaux coupés (`GDAHUB_AUTH_SEULE`). |
| Fichiers déposés (pièces d'identité clients, justificatifs RH, photos) **lisibles sans compte** par simple adresse. | Critique | Contrôle par identity avant chaque fichier (`auth_request`, habilitation de l'application propriétaire). |
| Vue Django `/storage/` de Campagnes servant les fichiers sans contrôle (seconde porte). | Moyenne | Fermée en production, compte exigé en développement. |
| Lien « Administration » affiché à tous. | Faible | Réservé aux administrateurs du hub (le serveur refusait déjà). |
| Commerciaux externes voyant le hub et ses autres applications. | Moyenne | Confinés à Campagnes (`commercialExterne.ts`, redirection systématique). |

**Vérifié par le pentest** : IDOR sur clients et ventes Campagnes (autre commercial, autre banque BDM/UBA), demandes d'absence d'un collègue, validation par un salarié, élévation au super-admin, auto-attribution d'habilitation, partenaire Chantiers en écriture, commercial Jus d'orange sur la production, client Planning sur un autre client — **tous refusés**.

### A02 — Défaillances cryptographiques

| Constat | Gravité | Correction |
|---|---|---|
| Production en `DJANGO_DEBUG=True` : cookie d'accès sans attribut `Secure`, pages d'erreur détaillées. | Critique | `DEBUG=False`. |
| Clé secrète Django et mot de passe des 6 bases = valeurs par défaut écrites dans le dépôt (aucun `.env` en production). | Critique | Secrets obligatoires (`${VAR:?}`), `infra/securiser-production.sh` (génère, change les mots de passe des bases). |
| Jus d'orange, Chantiers, Planning lisaient `SECRET_KEY`/`DEBUG` au lieu de `DJANGO_*` : clé par défaut et **débogage actif en production** même avec un `.env` correct. | Critique | Variables alignées + **garde-fou** : les 6 services refusent de démarrer en production avec une clé par défaut (vérifié). |
| HSTS absent. | Faible | Ajouté quand la requête arrive en https. |

Jetons : RS256, 15 min, révocation à la déconnexion, clé privée confinée à identity — **conformes**. Attaques `alg=none` et confusion HS256/clé publique **refusées**.

### A03 — Injection

| Constat | Gravité | Correction |
|---|---|---|
| Téléversements sans contrôle de type (photos Chantiers, pièces Campagnes, justificatifs) : un `.html`/`.svg` piégé servi sur l'origine du hub = **XSS stockée**. | Élevée | Contrôle par le contenu réel (Pillow / signature PDF) + noms aléatoires ; à la passerelle, types restreints, téléchargement forcé pour le reste, CSP `sandbox` sur tous les fichiers. |
| Pagination Campagnes injectée en HTML brut. | Faible | Affichée en texte. |

SQL : ORM ou requêtes paramétrées ; sondes d'injection dans les filtres et le tri **sans effet**.

### A04 — Conception non sécurisée

- Limite de tentatives de connexion à la passerelle (par adresse réelle) en plus d'identity — vérifié (429).
- Commerciaux externes, rôles par application, cloisonnement multi-clients (BDM/UBA) testés.

### A05 — Mauvaise configuration

| Constat | Gravité | Correction |
|---|---|---|
| Admin Django d'identity exposé publiquement (`/admin/`). | Élevée | Fermé (l'administration passe par `/administration`). |
| Aucun en-tête de sécurité ; version de nginx affichée. | Moyenne | nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS ; `server_tokens off`. |
| Pas de CSP. | Moyenne | CSP stricte sur l'interface de production (vérifiée sans violation). |
| `X-Forwarded-Proto` écrasé (les services se croyaient en http). | Faible | Protocole d'origine transmis. |
| Traversée de répertoire : réponse 500. | Faible | Rejet 400 à la passerelle (aucune fuite constatée). |
| Lien direct vers `/campagnes/...` : erreur 500. | Faible | Redirigé vers l'écran du hub. |
| 502 après chaque recréation de conteneur. | Disponibilité | Résolution DNS dynamique des services. |

### A06 — Composants vulnérables

| Composant | Avant | Après |
|---|---|---|
| PyJWT (identity) | 2.10.1 (6 CVE) | 2.15 |
| requests (identity) | 2.32.5 | 2.33 |
| Django (identity, FinanceRH) | 6.1 | 6.1.1 |
| Django (Jus d'orange) | 4.2.30 (hors support) | 5.2.17 LTS |
| Django (Chantiers, Planning) | 5.1.15 | 5.2.17 LTS |
| urllib3 (Campagnes, dépendance indirecte) | 2.7.0 (3 CVE) | ≥ 2.8 |
| pip (images Docker) | 25.0.1 | ≥ 26.2 |

Après mise à jour : tests unitaires, recette (82/82) et pentest (43/43) rejoués avec succès ; Jus d'orange (4.2 → 5.2) sans migration manquante.

### A07 — Identification et authentification

- Connexion unique par le hub ; refus des comptes inconnus et mots de passe faux ; jetons de rafraîchissement révoqués à la déconnexion (vérifié) ; cookie `HttpOnly`, `SameSite`, `Secure` en production.

### A08 — Intégrité des logiciels et des données

- Service worker : jamais de cache pour `/api/`, `/campagnes/`, `/media/` (aucune donnée privée sur un appareil partagé).
- Dépendances figées ; images reconstruites à chaque déploiement.

### A09 — Journalisation

- Journal des connexions (identity), journal d'activité Chantiers, journaux des services. Recommandation : centraliser et alerter (voir plus bas).

### A10 — SSRF

| Constat | Gravité | Correction |
|---|---|---|
| Abonnement push : le serveur envoie des requêtes à une adresse fournie par l'utilisateur (adresses internes, métadonnées cloud possibles). | Élevée | Liste blanche des services push (Google, Mozilla, Apple, Microsoft), https/443 uniquement — testé contre adresse interne, 169.254.169.254, domaine piégé, port exotique. |

Météo : adresse fixe (Open-Meteo), sans risque.

## Risques résiduels et recommandations

1. **Jetons dans le stockage du navigateur** (`localStorage`) : une XSS les exposerait. Atténué par la CSP stricte ; à terme, passer le jeton d'accès en cookie `HttpOnly` uniquement.
2. **Mot de passe `1234`** : propre à l'environnement local de test. En production, ne **jamais** lancer `synchroniser_comptes.py` avec `MOT_DE_PASSE_UNIQUE`.
3. **Identifiants root du VPS** partagés en clair dans une conversation antérieure : **à changer**, et désactiver la connexion SSH par mot de passe (clés uniquement).
4. **Politique de mots de passe** : imposer un changement à la première connexion pour les comptes repris.
5. **Sauvegardes** chiffrées et automatiques des 6 bases ; tester une restauration.
6. **Supervision** : alertes sur les échecs de connexion répétés (journal identity) et les 5xx de la passerelle.
7. **Double authentification** pour les administrateurs du hub.

## Rejouer l'audit

```bash
python scripts/tests/verifier_securite.py      # recette (comptes de test créés/supprimés)
python scripts/tests/pentest_acces.py          # pentest, local uniquement (vrais comptes, mdp 1234)
docker exec gdahub-identity  python manage.py test comptes
docker exec gdahub-financerh python manage.py test accounts core
docker exec gdahub-jusorange python manage.py test
npm audit --omit=dev
```
