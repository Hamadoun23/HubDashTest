"""Matrice des rôles de GDA Hub : qui peut lire / écrire quoi, application par application.

    python scripts/tests/matrice_roles.py [--base http://localhost:8080] [--mdp 1234]

Environnement LOCAL uniquement (mot de passe unique des comptes de test).
Complète pentest_acces.py, qui vise des attaques ciblées, par un balayage :

1. Cloisonnement entre applications : chaque compte appelle les listes de
   TOUTES les applications ; sans habilitation, tout doit être refusé.
2. Écritures par les rôles en lecture seule ou limités (partenaire Chantiers,
   client et équipe Planning, commercial et production Jus, salarié RH).
3. Écrans réservés de Campagnes (admin, direction) ouverts par un commercial.
4. Administration du hub (comptes, habilitations, journal) par un non-admin.
5. Cloisonnement des données : un salarié ne voit que ses propres demandes.
6. Révocation : une habilitation retirée cesse au rafraîchissement du jeton.

Un « ÉCHEC » est une faille ; « INFO » signale un accès à confirmer métier.
"""
import argparse
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0])
from pentest_acces import Client, refuse, sql  # noqa: E402

resultats = []


def verifier(nom, ok, detail=""):
    resultats.append((nom, bool(ok)))
    if not ok:
        print(f"  ÉCHEC {nom}{f'  ({detail})' if detail else ''}")


def info(nom):
    print(f"  INFO  {nom}")


# Listes à balayer, par application du hub (code d'habilitation).
LISTES = {
    "rh": ["/api/rh/demandes-absence/", "/api/rh/soldes-conges/", "/api/rh/presences/", "/api/rh/evaluations/",
           "/api/rh/types-absence/", "/api/rh/campagnes/", "/api/rh/inscriptions/", "/api/utilisateurs/", "/api/departements/"],
    "finance": ["/api/finance/depenses/", "/api/finance/missions/", "/api/finance/requisitions/", "/api/finance/caisses/",
                "/api/finance/fournisseurs/", "/api/finance/bons-commande/", "/api/finance/sorties-caisse/",
                "/api/finance/seuils/", "/api/finance/forfaits/", "/api/finance/prestations/"],
    "orange": ["/api/jus/ventes/", "/api/jus/clients/", "/api/jus/cueillettes/", "/api/jus/productions/",
               "/api/jus/factures/", "/api/jus/paiements/", "/api/jus/options/", "/api/jus/auth/me/"],
    "daily": ["/api/chantiers/projets/", "/api/chantiers/taches/", "/api/chantiers/photos/", "/api/chantiers/rapports/",
              "/api/chantiers/dashboard/", "/api/chantiers/mises-a-jour/"],
    "planning": ["/api/planning/clients/", "/api/planning/publications/", "/api/planning/tournages/",
                 "/api/planning/idees-contenu/", "/api/planning/tableau-de-bord/"],
    "campagnes": ["/campagnes/dashboard", "/campagnes/ventes", "/campagnes/clients", "/campagnes/enrolements"],
}
# RH et Finance sont une seule application Django : une habilitation de la
# famille donne accès au service (le rôle filtre ensuite les données).
FAMILLE = {"rh": {"rh", "finance", "direction", "organisation"}, "finance": {"rh", "finance", "direction", "organisation"}}


def accorde(r):
    if r.status_code == 200 and r.headers.get("X-Inertia") == "true":
        return True
    return r.status_code == 200


def nb(r):
    try:
        d = r.json()
    except ValueError:
        return None
    if isinstance(d, list):
        return len(d)
    if isinstance(d, dict):
        return d.get("count", len(d.get("results", [])) if "results" in d else None)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8080")
    ap.add_argument("--mdp", default="1234")
    a = ap.parse_args()
    B = a.base.rstrip("/")

    comptes = {
        "admin hub": "hcisse@gdamali.net",
        "salarié RH/Finance": "hballo@gdamali.net",
        "gestionnaire RH": "askoita@gdamali.net",
        "gestionnaire Finance": "sfofana@gdamali.net",
        "commercial Campagnes": "74082712",
        "direction Campagnes": "direction@bdm.local",
        "commercial Jus": "commercial@jusorange.local",
        "production Jus": "resprod@jusorange.local",
        "partenaire Chantiers": "b2gold",
        "client Planning": "gda",
    }
    print("Connexion des comptes…")
    c, habs = {}, {}
    for role, ident in comptes.items():
        c[role] = Client(B, ident, a.mdp)
        habs[role] = set(c[role].req("GET", "/api/identity/auth/moi").json().get("habilitations", {}).keys())
        print(f"  {role:22} {ident:28} {sorted(habs[role])}")

    # 1. Cloisonnement entre applications -----------------------------------
    print("\n1. Cloisonnement entre applications")
    for role, cl in c.items():
        for app, chemins in LISTES.items():
            habilite = bool(habs[role] & FAMILLE.get(app, {app}))
            for ch in chemins:
                r = cl.req("GET", ch)
                if r.status_code >= 500:
                    verifier(f"{role} : {ch} sans erreur serveur", False, f"statut {r.status_code}")
                elif not habilite:
                    verifier(f"{role} (sans habilitation {app}) : {ch} refusé", not accorde(r), f"statut {r.status_code}")
                else:
                    resultats.append((f"{role} {ch}", True))
                    if not accorde(r) and role == "admin hub":
                        info(f"admin hub refusé sur {ch} (statut {r.status_code})")

    # 2. Écritures par les rôles limités ------------------------------------
    print("2. Écritures réservées")
    ecritures_interdites = {
        "partenaire Chantiers": ["/api/chantiers/projets/", "/api/chantiers/taches/", "/api/chantiers/phases/",
                                 "/api/chantiers/mises-a-jour/", "/api/chantiers/rapports/generate/", "/api/chantiers/photos/bulk-delete/"],
        "client Planning": ["/api/planning/clients/", "/api/planning/publications/", "/api/planning/tournages/", "/api/planning/idees-contenu/"],
        "salarié RH/Finance": ["/api/rh/types-absence/", "/api/departements/", "/api/rh/criteres/", "/api/rh/campagnes/",
                               "/api/finance/baremes-perdiem/", "/api/finance/caisses/", "/api/finance/categories-depense/",
                               "/api/finance/fournisseurs/", "/api/finance/seuils/", "/api/finance/forfaits/",
                               "/api/finance/approvisionnements/", "/api/rh/soldes-conges/", "/api/utilisateurs/",
                               "/api/planning/publications/", "/api/planning/clients/"],
        "commercial Jus": ["/api/jus/cueillettes/", "/api/jus/receptions/", "/api/jus/productions/", "/api/jus/conditionnements/",
                           "/api/jus/bouteilles/", "/api/jus/inventaires/", "/api/jus/articles/", "/api/jus/producteurs/",
                           "/api/jus/utilisateurs/"],
        "production Jus": ["/api/jus/ventes/", "/api/jus/commandes/", "/api/jus/factures/", "/api/jus/paiements/",
                           "/api/jus/clients/", "/api/jus/tresorerie/", "/api/jus/utilisateurs/"],
    }
    for role, chemins in ecritures_interdites.items():
        for ch in chemins:
            r = c[role].req("POST", ch, json={})
            # 400 = la permission est passée, seule la validation a bloqué.
            verifier(f"{role} : POST {ch} refusé", r.status_code in (401, 403, 405), f"statut {r.status_code}")
    lectures_interdites = {
        "salarié RH/Finance": ["/api/rh/indicateurs/", "/api/rh/scoring/", "/api/finance/approvisionnements/", "/api/finance/consommations/"],
        "partenaire Chantiers": ["/api/chantiers/activity-logs/"],
        "client Planning": ["/api/planning/publications/", "/api/planning/idees-contenu/", "/api/planning/tableau-de-bord/",
                            "/api/planning/statistiques/", "/api/planning/regles-publication/"],
        "commercial Jus": ["/api/jus/utilisateurs/", "/api/jus/reporting/recolte/", "/api/jus/reporting/fabrication/"],
        "production Jus": ["/api/jus/utilisateurs/", "/api/jus/reporting/distribution/"],
    }
    for role, chemins in lectures_interdites.items():
        for ch in chemins:
            r = c[role].req("GET", ch)
            verifier(f"{role} : GET {ch} refusé", not accorde(r), f"statut {r.status_code}")
    r = c["client Planning"].req("GET", "/api/planning/clients/")
    verifier("client Planning : ne voit que son client", (nb(r) or 0) <= 1, f"{nb(r)} clients")

    # 3. Campagnes : écrans réservés --------------------------------------------
    print("3. Campagnes : écrans réservés")
    for ch in ["/campagnes/admin/campagnes", "/campagnes/admin/campagnes/create", "/campagnes/admin/users", "/campagnes/admin/agences",
               "/campagnes/admin/types-cartes", "/campagnes/admin/journal-connexions", "/campagnes/admin/reporting-telephonique",
               "/campagnes/direction/campagnes", "/campagnes/direction/types-de-cartes", "/campagnes/rapports",
               "/campagnes/rapports/export", "/campagnes/admin/reporting-telephonique/export"]:
        r = c["commercial Campagnes"].req("GET", ch)
        page = r.json().get("component", "") if r.headers.get("X-Inertia") == "true" else ""
        verifier(f"commercial Campagnes : {ch} refusé", not accorde(r) or not page.startswith(("Admin", "Direction", "Rapports", "Performances")),
                 f"statut {r.status_code} {page}")
    # Performances : ouverte au commercial, mais limitée à sa campagne.
    r = c["commercial Campagnes"].req("GET", "/campagnes/performances")
    verifier("commercial Campagnes : performances sans filtre d'agence admin", r.status_code == 200 and "agences" not in (r.json().get("props", {}) or {}).get("filtres", {}),
             f"statut {r.status_code}")
    # Paramètres invalides : jamais d'erreur serveur.
    for role in ["admin hub", "commercial Campagnes"]:
        for q in ["?du=xx&au=yy", "?periode=zz", "?agence=abc", "?campagne_id=abc", "?du=2026-13-45&au=2026-01-01"]:
            for ch in ["/campagnes/performances", "/campagnes/dashboard", "/campagnes/ventes", "/campagnes/rapports"]:
                r = c[role].req("GET", ch + q)
                verifier(f"{role} : {ch}{q} sans erreur serveur", r.status_code < 500, f"statut {r.status_code}")
    for ch in ["/campagnes/admin/campagnes", "/campagnes/admin/users/create", "/campagnes/admin/agences"]:
        r = c["direction Campagnes"].req("POST", ch, data={})
        verifier(f"direction Campagnes : POST {ch} refusé", r.status_code in (302, 403, 405) and "/admin/" not in r.headers.get("Location", "")[-30:]
                 or r.status_code in (403, 405), f"statut {r.status_code} → {r.headers.get('Location')}")
    for role in ["commercial Jus", "salarié RH/Finance", "partenaire Chantiers"]:
        r = c[role].req("POST", "/campagnes/api/ventes", data={})
        verifier(f"{role} : vente Campagnes refusée", refuse(r) and r.status_code != 200, f"statut {r.status_code}")

    # 4. Administration du hub ---------------------------------------------------
    print("4. Administration du hub")
    for role in [k for k in c if k != "admin hub"]:
        for meth, ch, corps in [("GET", "/api/identity/utilisateurs", None), ("GET", "/api/identity/habilitations", None),
                                ("GET", "/api/identity/connexions", None), ("POST", "/api/identity/utilisateurs", {"identifiant": "pirate", "nom": "X"}),
                                ("POST", "/api/identity/habilitations", {"utilisateur": c[role].id, "application": 1, "roles": ["admin"]}),
                                ("PATCH", f"/api/identity/utilisateurs/{c[role].id}", {"is_superuser": True})]:
            r = c[role].req(meth, ch, json=corps) if corps else c[role].req(meth, ch)
            verifier(f"{role} : {meth} {ch} refusé", refuse(r), f"statut {r.status_code}")
    moi = c["partenaire Chantiers"].req("GET", "/api/identity/auth/moi").json()
    verifier("aucune élévation obtenue", not moi.get("utilisateur", moi).get("est_superadmin"))
    # Notification d'un autre compte.
    autre_notif = sql("identity", f"select id from comptes_notification where utilisateur_id<>{c['partenaire Chantiers'].id} limit 1")
    if autre_notif:
        r = c["partenaire Chantiers"].req("POST", f"/api/identity/notifications/{autre_notif}/lue")
        lue = sql("identity", f"select lue from comptes_notification where id={autre_notif}")
        verifier("notification d'un autre compte non modifiable", r.status_code in (403, 404, 405) or lue == "f", f"statut {r.status_code}")

    # 5. Cloisonnement des données RH/Finance ------------------------------------
    print("5. Données personnelles RH/Finance")
    for ch in ["/api/rh/demandes-absence/", "/api/rh/soldes-conges/", "/api/rh/presences/", "/api/rh/evaluations/",
               "/api/finance/depenses/", "/api/finance/missions/", "/api/finance/requisitions/", "/api/finance/sorties-caisse/",
               "/api/finance/prestations/", "/api/finance/bons-commande/", "/api/rh/inscriptions/", "/api/finance/forfaits/"]:
        n_sal = nb(c["salarié RH/Finance"].req("GET", ch))
        n_adm = nb(c["admin hub"].req("GET", ch))
        if n_sal is not None and n_adm and n_sal == n_adm and n_adm > 2:
            info(f"salarié voit autant que l'admin sur {ch} ({n_sal}) — à confirmer")
        else:
            resultats.append((ch, True))

    # 6. Révocation ---------------------------------------------------------------
    print("6. Révocation d'une habilitation")
    adm = c["admin hub"]
    part = c["partenaire Chantiers"]
    hab = sql("identity", f"select h.id||'|'||h.application_id||'|'||h.roles::text||'|'||coalesce(h.identifiant_local,'') from comptes_habilitation h "
                          f"join comptes_application a on a.id=h.application_id where a.code='daily' and h.utilisateur_id={part.id}").split("|")
    if len(hab) == 4:
        hab_id, app_id, roles, local = hab
        avant = accorde(part.req("GET", "/api/chantiers/projets/"))
        r = adm.req("DELETE", f"/api/identity/habilitations/{hab_id}")
        try:
            rr = part.s.post(f"{B}/api/identity/auth/rafraichir", json={"rafraichissement": part.rafraichissement}, timeout=60)
            part.jeton = rr.json().get("acces", part.jeton)
            apres = accorde(part.req("GET", "/api/chantiers/projets/"))
            verifier("habilitation retirée : accès coupé après rafraîchissement", avant and not apres, f"avant={avant} après={apres} (DELETE {r.status_code})")
        finally:
            import json as _j
            adm.req("POST", "/api/identity/habilitations", json={"utilisateur": part.id, "application": int(app_id),
                                                                 "roles": _j.loads(roles), "identifiant_local": local})
            restaure = sql("identity", f"select count(*) from comptes_habilitation where utilisateur_id={part.id} and application_id={app_id}")
            verifier("habilitation de test restaurée", restaure == "1")

    ok = sum(1 for _, v in resultats if v)
    print(f"\n{ok}/{len(resultats)} contrôles réussis.")
    return 0 if ok == len(resultats) else 1


if __name__ == "__main__":
    sys.exit(main())
