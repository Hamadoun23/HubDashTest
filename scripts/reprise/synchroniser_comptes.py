"""Crée les comptes GDA Hub (identity) à partir des utilisateurs des applications.

À exécuter dans le conteneur identity, après avoir déposé dans /tmp/comptes
les fichiers produits par `extraire_utilisateurs.sh` :

    docker exec gdahub-identity sh -c "python manage.py shell < /tmp/comptes/synchroniser_comptes.py"

Règles :
- une personne = un compte, fusionné par identifiant ou par adresse quand elle
  est dans plusieurs applications ;
- identifiant de connexion : l'adresse (RH, Jus d'orange, direction
  Campagnes), le **téléphone** pour les commerciaux Campagnes (comme dans
  BDM), le nom d'utilisateur pour Chantiers et Planning, le nom pour les
  administrateurs Campagnes sans adresse ; toujours en minuscules ;
- chaque application reçoit son habilitation, rôle traduit, et l'identifiant
  sous lequel la personne y est connue (`identifiant_local`).

Mots de passe : **inchangés par défaut**. `MOT_DE_PASSE_UNIQUE=1234` (variable
d'environnement) donne ce mot de passe à tous les comptes — pour un
environnement de test seulement, jamais en production.
"""
import json
import os
from pathlib import Path

from django.db import transaction

from comptes.models import Application, Habilitation, Utilisateur

D = Path(os.environ.get("DOSSIER_COMPTES", "/tmp/comptes"))
MDP = os.environ.get("MOT_DE_PASSE_UNIQUE", "")
apps = {a.code: a for a in Application.objects.all()}

TRADUCTION_RH = {
    "SALARIE": {"organisation": ["lecture"], "rh": ["agent"], "finance": ["agent"]},
    "RH": {"organisation": ["gestionnaire"], "rh": ["gestionnaire"], "finance": ["agent"]},
    "FINANCE": {"organisation": ["lecture"], "rh": ["agent"], "finance": ["gestionnaire"]},
    "DIRECTION": {"organisation": ["gestionnaire"], "rh": ["direction"], "finance": ["direction"], "direction": ["membre"]},
}
GROUPES_JUS = {"Direction": "direction", "ResProd": "responsable_production", "Commercial": "commercial", "Finance": "finance"}
ROLES_DAILY = {"admin": "admin", "partner": "partenaire", "partenaire": "partenaire"}
rapport = []


def charger(nom):
    chemin = D / f"{nom}.json"
    return json.loads(chemin.read_text(encoding="utf-8")) if chemin.exists() else []


def compte(identifiant, email="", nom="", prenom="", fonction=""):
    identifiant = (identifiant or "").strip().lower()
    email = (email or "").strip()
    u = Utilisateur.objects.filter(identifiant=identifiant).first()
    if u is None and email:
        u = Utilisateur.objects.filter(email__iexact=email).first() or Utilisateur.objects.filter(identifiant=email.lower()).first()
    nouveau = u is None
    if nouveau:
        u = Utilisateur(identifiant=identifiant, email=email, nom=(nom or identifiant)[:100], prenom=(prenom or "")[:100], fonction=(fonction or "")[:150])
    elif not u.email and email:
        u.email = email
    u.est_actif = True
    if MDP:
        u.set_password(MDP)
    elif nouveau:
        u.set_unusable_password()  # à définir par l'administration du hub
    u.save()
    return u


def habiliter(u, code, roles, local=""):
    h, cree = Habilitation.objects.get_or_create(
        utilisateur=u, application=apps[code], defaults={"roles": roles, "identifiant_local": local, "active": True}
    )
    if not cree:
        h.roles = sorted(set(h.roles or []) | set(roles))
        h.identifiant_local = h.identifiant_local or local
        h.active = True
        h.save()


with transaction.atomic():
    for r in charger("rh"):
        ident = r["email"] or r["username"]
        u = compte(ident, r["email"], r["nom"], r["prenom"], r.get("poste") or "")
        for code, roles in TRADUCTION_RH.get(r["role"], TRADUCTION_RH["SALARIE"]).items():
            habiliter(u, code, roles, ident if code in ("rh", "finance") else "")
        rapport.append(["rh", u.identifiant, f"{r['prenom']} {r['nom']}".strip(), r["role"], r.get("poste") or ""])

    for r in charger("jus"):
        role = "admin" if r["superuser"] or not r["groupes"] else GROUPES_JUS.get(r["groupes"][0], "commercial")
        u = compte(r["email"] or r["username"], r["email"], r["nom"] or r["username"], r["prenom"])
        habiliter(u, "orange", [role], r["username"])
        rapport.append(["orange", u.identifiant, f"{r['prenom']} {r['nom']}".strip() or r["username"], role, ", ".join(r["groupes"])])

    for r in charger("campagnes"):
        commercial = "commercial" in r["role"]
        ident = (r["telephone"] or r["email"]) if commercial else (r["email"] or r["telephone"] or r["nom"])
        if not ident:
            continue
        u = compte(ident, r["email"] or "", r["nom"], r["prenom"] or "", "Commercial" if commercial else r["role"].capitalize())
        habiliter(u, "campagnes", [r["role"]], r["telephone"] if commercial and r["telephone"] else (r["email"] or r["nom"]))
        detail = " · ".join(x for x in [(r["partenaire"] or "").upper(), r["agence"] or "", r["telephone"] or ""] if x)
        rapport.append(["campagnes", u.identifiant, f"{r['prenom'] or ''} {r['nom']}".strip(), r["role"], detail])

    for r in charger("daily"):
        role = ROLES_DAILY.get(r["role"], "ingenieur")
        u = compte(r["username"], "", r["name"] or r["username"])
        habiliter(u, "daily", [role], r["username"])
        rapport.append(["daily", u.identifiant, r["name"] or r["username"], role, ""])

    for r in charger("planning"):
        role = r["role"] if r["role"] in ("admin", "team", "client") else "team"
        u = compte(r["username"], "", r["username"])
        habiliter(u, "planning", [role], str(r["client_id"]) if role == "client" and r.get("client_id") else r["username"])
        rapport.append(["planning", u.identifiant, r["username"], role, f"client n°{r['client_id']}" if role == "client" else ""])

    if MDP:
        for u in Utilisateur.objects.all():
            u.set_password(MDP)
            u.save(update_fields=["password"])

admins = [
    [u.identifiant, f"{u.prenom} {u.nom}".strip(), bool(u.is_superuser), [x for h in u.habilitations.filter(application__code="hub") for x in h.roles]]
    for u in Utilisateur.objects.all()
    if u.is_superuser or u.habilitations.filter(application__code="hub").exists()
]
(D / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False), encoding="utf-8")
(D / "admins.json").write_text(json.dumps(admins, ensure_ascii=False), encoding="utf-8")
print("SYNCHRO", len(rapport), "lignes ;", Utilisateur.objects.count(), "comptes ;", Habilitation.objects.count(), "habilitations")
