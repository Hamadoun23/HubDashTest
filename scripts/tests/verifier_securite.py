"""Recette de sécurité de GDA Hub, en boîte noire, contre la passerelle.

    python scripts/tests/verifier_securite.py [--base http://localhost:8080]

La règle vérifiée : **la connexion et les accès passent uniquement par le hub**
(identity), jamais par une application.

  1. Passerelle : admin Django fermé, connexions locales des applications
     fermées, en-têtes de sécurité, fichiers déposés refusés sans compte.
  2. Identity : mot de passe faux refusé, cookie d'accès protégé.
  3. Fichiers déposés : servis au compte habilité, refusés aux autres.
  4. Chaque application : refus sans jeton, avec un jeton falsifié, avec un
     jeton expiré, avec un compte du hub non habilité (même s'il a un compte
     local) ; accès avec un compte habilité.
  5. Administration du hub et cloisonnement d'un commercial externe.
  6. Déconnexion : le jeton de rafraîchissement ne sert plus.
  7. Tentatives de connexion répétées bloquées.

Les comptes et fichiers de test sont créés au début (dans les conteneurs,
par `docker exec`) et supprimés à la fin, même en cas d'échec.
"""
import argparse
import base64
import json
import subprocess
import sys

import requests

MDP = "Recette-2026!x"
PREFIXE = "recette.securite"
COMPTES = {
    "sans": f"{PREFIXE}.sans@test.local",
    "complet": f"{PREFIXE}.complet@test.local",
    "commercial": f"{PREFIXE}.commercial@test.local",
}

# Une route de lecture par application.
APPLICATIONS = [
    ("RH", "/api/rh/types-absence/"),
    ("Finance", "/api/finance/categories-depense/"),
    # Jus d'orange : la route du profil, ouverte à tout compte authentifié (les
    # listes métier exigent en plus un rôle propre à l'application).
    ("Jus d'orange", "/api/jus/auth/me/"),
    ("Chantiers", "/api/chantiers/projets/"),
    ("Planning", "/api/planning/clients/"),
    ("Campagnes", "/campagnes/ventes"),
]

# Fichiers témoins, un par dossier protégé : (conteneur, dossier média, adresse publique).
SONDES = [
    ("gdahub-financerh", "/app/media", "/media/rh/"),
    ("gdahub-jusorange", "/app/media", "/media/jus/"),
    ("gdahub-chantiers", "/app/media", "/media/chantiers/"),
    ("gdahub-planning", "/app/media", "/media/planning/"),
    ("gdahub-campagnes", "/app/media", "/campagnes/storage/"),
    ("gdahub-identity", "/app/media", "/media/hub/"),
]
NOM_SONDE = "recette-securite-sonde.txt"

resultats = []


def verifier(nom, condition, detail=""):
    resultats.append((nom, bool(condition), detail))
    print(f"  {'OK   ' if condition else 'ÉCHEC'} {nom}{f'  ({detail})' if detail and not condition else ''}")


def shell(conteneur, code):
    sortie = subprocess.run(
        ["docker", "exec", "-i", conteneur, "python", "manage.py", "shell"],
        input=code, capture_output=True, text=True, timeout=300, encoding="utf-8",
    )
    return sortie.stdout + sortie.stderr


# --- Comptes de test ---------------------------------------------------------

CREER_IDENTITY = f"""
from comptes.models import Utilisateur, Application, Habilitation
comptes = {json.dumps(COMPTES)}
for cle, ident in comptes.items():
    u, _ = Utilisateur.objects.get_or_create(identifiant=ident, defaults={{'nom': 'RECETTE', 'prenom': cle, 'email': ident}})
    u.set_password({MDP!r}); u.est_actif = True; u.save()
    Habilitation.objects.filter(utilisateur=u).delete()
    if cle == 'complet':
        for app in Application.objects.filter(active=True).exclude(code='hub'):
            premier = (app.roles_disponibles or ['admin'])[0]
            roles = ['admin'] if app.code == 'campagnes' else [premier['code'] if isinstance(premier, dict) else premier]
            Habilitation.objects.create(utilisateur=u, application=app, roles=roles, identifiant_local=ident)
    if cle == 'commercial':
        Habilitation.objects.create(utilisateur=u, application=Application.objects.get(code='campagnes'), roles=['commercial'], identifiant_local=ident)
print('IDENTITY-OK')
"""
CREER_CAMPAGNES = f"""
from core.models import User
for ident, role in [({COMPTES['complet']!r}, 'admin'), ({COMPTES['commercial']!r}, 'commercial'), ({COMPTES['sans']!r}, 'admin')]:
    u, _ = User.objects.get_or_create(email=ident, defaults={{'name': 'RECETTE', 'prenom': role, 'role': role, 'actif': True}})
    u.set_password({MDP!r}); u.save()
print('CAMPAGNES-OK')
"""
# FinanceRH et Jus d'orange rattachent le compte du hub à un agent local par
# l'adresse : « sans » en a un aussi, pour vérifier que l'habilitation du hub
# est exigée même quand le compte local existe.
CREER_FINANCERH = f"""
from accounts.models import Utilisateur
for i, ident in enumerate([{COMPTES['complet']!r}, {COMPTES['sans']!r}]):
    Utilisateur.objects.get_or_create(email=ident, defaults={{'username': ident, 'matricule': f'RECETTE-{{i}}'}})
print('FINANCERH-OK')
"""
CREER_JUS = f"""
from django.contrib.auth import get_user_model
U = get_user_model()
for ident in [{COMPTES['complet']!r}, {COMPTES['sans']!r}]:
    U.objects.get_or_create(username=ident, defaults={{'email': ident}})
print('JUS-OK')
"""
SUPPRIMER_IDENTITY = f"""
from comptes.models import Utilisateur, JournalConnexion
JournalConnexion.objects.filter(identifiant_saisi__startswith={PREFIXE!r}).delete()
print(Utilisateur.objects.filter(identifiant__startswith={PREFIXE!r}).delete())
"""
SUPPRIMER_CAMPAGNES = f"""
from core.models import User, UserLoginLog
ids = list(User.objects.filter(email__startswith={PREFIXE!r}).values_list('id', flat=True))
UserLoginLog.objects.filter(user_id__in=ids).delete()
print(User.objects.filter(id__in=ids).delete())
"""
SUPPRIMER_LOCAUX = f"""
from django.contrib.auth import get_user_model
print(get_user_model().objects.filter(email__startswith={PREFIXE!r}).delete())
"""
JETON_EXPIRE = f"""
from datetime import timedelta
from unittest import mock
from django.utils import timezone
from comptes.models import Utilisateur
from comptes import jetons
u = Utilisateur.objects.get(identifiant={COMPTES['complet']!r})
passe = timezone.now() - timedelta(hours=2)
with mock.patch('django.utils.timezone.now', return_value=passe):
    print('JETON=' + jetons.emettre_acces(u))
"""


def sondes(creer):
    for conteneur, dossier, _ in SONDES:
        commande = f"echo sonde > {dossier}/{NOM_SONDE}" if creer else f"rm -f {dossier}/{NOM_SONDE}"
        subprocess.run(["docker", "exec", conteneur, "sh", "-c", commande], capture_output=True, timeout=180)


def jeton_falsifie(vrai):
    """Même en-tête qu'un vrai jeton, contenu élevé au rang de super-admin, signature bidon."""
    entete, charge, _ = vrai.split(".")
    donnees = json.loads(base64.urlsafe_b64decode(charge + "=" * (-len(charge) % 4)))
    donnees["est_superadmin"] = True
    nouvelle = base64.urlsafe_b64encode(json.dumps(donnees).encode()).decode().rstrip("=")
    return f"{entete}.{nouvelle}.{base64.urlsafe_b64encode(b'signature-bidon').decode().rstrip('=')}"


def connexion(base, identifiant, mdp=MDP):
    return requests.post(f"{base}/api/identity/auth/connexion", json={"identifiant": identifiant, "mot_de_passe": mdp}, timeout=180)


def appel(base, chemin, jeton=None, methode="GET", **kw):
    entetes = {"Accept": "application/json"}
    if chemin.startswith("/campagnes/") and "/storage/" not in chemin:
        entetes.update({"X-Inertia": "true", "X-Requested-With": "XMLHttpRequest"})
    if jeton:
        entetes["Authorization"] = f"Bearer {jeton}"
    return requests.request(methode, f"{base}{chemin}", headers=entetes, timeout=180, allow_redirects=False, **kw)


def refuse(r):
    """Refus : 401/403, ou pour Campagnes une redirection vers son écran de connexion."""
    if r.status_code in (401, 403):
        return True
    lieu = r.headers.get("Location", "") + r.headers.get("X-Inertia-Location", "")
    return r.status_code in (302, 303, 409) and "login" in lieu


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8080")
    base = parser.parse_args().base.rstrip("/")

    print("Préparation des comptes et fichiers de test…")
    prets = [
        "IDENTITY-OK" in shell("gdahub-identity", CREER_IDENTITY),
        "CAMPAGNES-OK" in shell("gdahub-campagnes", CREER_CAMPAGNES),
        "FINANCERH-OK" in shell("gdahub-financerh", CREER_FINANCERH),
        "JUS-OK" in shell("gdahub-jusorange", CREER_JUS),
    ]
    sondes(True)
    try:
        if not all(prets):
            print("Impossible de créer les comptes de test.", prets)
            return 2
        return recette(base)
    finally:
        print("\nNettoyage des comptes et fichiers de test…")
        sondes(False)
        shell("gdahub-identity", SUPPRIMER_IDENTITY)
        shell("gdahub-campagnes", SUPPRIMER_CAMPAGNES)
        shell("gdahub-financerh", SUPPRIMER_LOCAUX)
        shell("gdahub-jusorange", SUPPRIMER_LOCAUX)


def recette(base):
    print("\n1. Passerelle")
    r = requests.get(f"{base}/admin/", timeout=180, allow_redirects=False)
    verifier("Admin Django d'identity non exposé", r.status_code == 404, f"statut {r.status_code}")
    for nom, chemin in [
        ("Connexion locale FinanceRH fermée", "/api/auth/connexion/"),
        ("Rafraîchissement local FinanceRH fermé", "/api/auth/refresh/"),
        ("Connexion locale Jus d'orange fermée", "/api/jus/auth/login/"),
        ("Connexion locale Campagnes fermée", "/campagnes/login"),
        ("Mot de passe oublié Campagnes fermé", "/campagnes/forgot-password"),
        ("Réinitialisation Campagnes fermée", "/campagnes/reset-password"),
    ]:
        r = requests.post(f"{base}{chemin}", json={"identifiant": "x", "password": "x", "username": "x", "email": "x@x.x"}, timeout=180, allow_redirects=False)
        verifier(nom, r.status_code in (403, 404, 405), f"statut {r.status_code}")

    r = requests.get(f"{base}/", timeout=180)
    for entete in ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]:
        verifier(f"En-tête {entete} sur l'interface", entete in r.headers)
    verifier("Version de nginx masquée", "nginx/" not in r.headers.get("Server", ""), r.headers.get("Server", ""))
    for _, _, url in SONDES:
        r = requests.get(f"{base}{url}{NOM_SONDE}", timeout=180, allow_redirects=False)
        verifier(f"Fichier {url} refusé sans compte", r.status_code in (401, 403), f"statut {r.status_code}")

    print("\n2. Identity")
    r = connexion(base, COMPTES["sans"], "mauvais-mot-de-passe")
    verifier("Mot de passe faux refusé", r.status_code in (400, 401), f"statut {r.status_code}")
    r = connexion(base, "personne.inconnue@test.local", "x")
    verifier("Compte inconnu refusé", r.status_code in (400, 401), f"statut {r.status_code}")
    jetons = {}
    for cle, ident in COMPTES.items():
        r = connexion(base, ident)
        verifier(f"Connexion du compte « {cle} »", r.status_code == 200, f"statut {r.status_code}")
        if r.status_code == 200:
            d = r.json()
            jetons[cle] = (d.get("acces") or d.get("access"), d.get("rafraichissement") or d.get("refresh"))
    if len(jetons) < 3:
        print("  Comptes de test inutilisables, arrêt.")
        return 1
    cookie = connexion(base, COMPTES["complet"]).headers.get("Set-Cookie", "")
    verifier("Cookie d'accès HttpOnly", "HttpOnly" in cookie)
    verifier("Cookie d'accès SameSite", "SameSite" in cookie)

    acces_complet = jetons["complet"][0]
    faux = jeton_falsifie(acces_complet)
    sortie = shell("gdahub-identity", JETON_EXPIRE)
    expire = next((l.split("=", 1)[1] for l in sortie.splitlines() if l.startswith("JETON=")), None)

    print("\n3. Fichiers déposés, avec un compte")
    for _, _, url in SONDES:
        r = appel(base, f"{url}{NOM_SONDE}", acces_complet)
        verifier(f"Fichier {url} servi à un compte habilité", r.status_code == 200, f"statut {r.status_code}")
        if url != "/media/hub/":
            r = appel(base, f"{url}{NOM_SONDE}", jetons["sans"][0])
            verifier(f"Fichier {url} refusé à un compte non habilité", r.status_code == 403, f"statut {r.status_code}")
        r = appel(base, f"{url}{NOM_SONDE}", faux)
        verifier(f"Fichier {url} refusé avec un jeton falsifié", r.status_code == 401, f"statut {r.status_code}")

    print("\n4. Applications")
    for nom, chemin in APPLICATIONS:
        r = appel(base, chemin)
        verifier(f"{nom} : refus sans jeton", refuse(r), f"statut {r.status_code}")
        r = appel(base, chemin, faux)
        verifier(f"{nom} : refus d'un jeton falsifié", refuse(r), f"statut {r.status_code}")
        if expire:
            r = appel(base, chemin, expire)
            verifier(f"{nom} : refus d'un jeton expiré", refuse(r), f"statut {r.status_code}")
        r = appel(base, chemin, jetons["sans"][0])
        verifier(f"{nom} : refus d'un compte non habilité", refuse(r), f"statut {r.status_code}")
        r = appel(base, chemin, acces_complet)
        # Campagnes : un administrateur est d'abord envoyé au choix du client.
        ok = r.status_code == 200 or (chemin.startswith("/campagnes/") and "choix-client" in r.headers.get("Location", ""))
        verifier(f"{nom} : accès d'un compte habilité", ok, f"statut {r.status_code}")

    print("\n5. Administration du hub et cloisonnement")
    r = appel(base, "/api/identity/utilisateurs", jetons["sans"][0])
    verifier("Liste des comptes refusée à un non-administrateur", r.status_code in (401, 403), f"statut {r.status_code}")
    r = appel(base, "/api/identity/habilitations", jetons["commercial"][0], methode="POST", json={"utilisateur": 1, "application": 1, "roles": ["admin"]})
    verifier("Un commercial ne peut pas s'attribuer de droits", r.status_code in (401, 403), f"statut {r.status_code}")
    r = appel(base, "/campagnes/admin/campagnes", jetons["commercial"][0])
    verifier("Commercial : écrans d'administration de Campagnes refusés", r.status_code != 200, f"statut {r.status_code}")
    for nom, chemin in APPLICATIONS[:-1]:
        r = appel(base, chemin, jetons["commercial"][0])
        verifier(f"Commercial : {nom} refusé", refuse(r), f"statut {r.status_code}")

    print("\n6. Déconnexion")
    acces, rafraichissement = jetons["sans"]
    requests.post(f"{base}/api/identity/auth/deconnexion", headers={"Authorization": f"Bearer {acces}"}, json={"rafraichissement": rafraichissement}, timeout=180)
    r = requests.post(f"{base}/api/identity/auth/rafraichir", json={"rafraichissement": rafraichissement}, timeout=180)
    verifier("Jeton de rafraîchissement inutilisable après déconnexion", r.status_code in (400, 401, 403), f"statut {r.status_code}")

    print("\n7. Limitation des tentatives de connexion")
    statuts = [connexion(base, COMPTES["sans"], f"faux-{i}").status_code for i in range(25)]
    verifier("Tentatives répétées bloquées (429)", 429 in statuts, f"statuts {sorted(set(statuts))}")

    echecs = [n for n, ok, _ in resultats if not ok]
    print(f"\n{len(resultats) - len(echecs)}/{len(resultats)} vérifications réussies.")
    if echecs:
        print("Échecs :\n  - " + "\n  - ".join(echecs))
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
