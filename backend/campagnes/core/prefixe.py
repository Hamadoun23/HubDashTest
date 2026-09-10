"""Servir BDM sous un chemin, quand ses redirections l'ignorent.

`FORCE_SCRIPT_NAME` apprend a Django sous quel prefixe il vit, et `reverse()`
en tient compte. Mais BDM redirige souvent vers un chemin ecrit en toutes
lettres — `redirect("/dashboard")`, `redirect("/login")`, `redirect(
"/admin/users")` — et ceux-la partent tels quels. Servie sous « /bdm », la
premiere redirection sortait du perimetre de l'application : le navigateur
arrivait sur la coquille du hub, ou sur une page inexistante.

**Pourquoi un seul point de passage plutot que quarante-sept corrections.**
Il y a 47 de ces chemins dans l'application. Les convertir un a un en routes
nommees serait plus juste sur le papier, mais chacun demande de deviner le
bon nom, dans du code qui fonctionne et qu'il ne faut pas casser. Une seule
regle, appliquee a la sortie, se verifie d'un coup d'oeil et couvre aussi
le code qu'on ecrira demain.

Le module est inerte quand `FORCE_SCRIPT_NAME` est absent : servie a la
racine sur bdm.gdamali.net, BDM ne voit aucune difference.
"""

from django.conf import settings


class PrefixeDeService:
    """Prefixe les redirections vers un chemin absolu du site."""

    def __init__(self, suivant):
        self.suivant = suivant

    def __call__(self, requete):
        reponse = self.suivant(requete)
        prefixe = (getattr(settings, "FORCE_SCRIPT_NAME", "") or "").rstrip("/")
        if not prefixe:
            return reponse

        lieu = reponse.headers.get("Location")
        if not lieu:
            return reponse

        # Seuls les chemins du site sont concernes. « //ailleurs.example »
        # designe un autre hote malgre sa barre oblique initiale, et une
        # adresse complete se suffit a elle-meme.
        if not lieu.startswith("/") or lieu.startswith("//"):
            return reponse

        # Deja prefixee : la redoubler donnerait « /bdm/bdm/login ». Le cas
        # se produit des que la redirection vient de `reverse()`.
        if lieu == prefixe or lieu.startswith(f"{prefixe}/"):
            return reponse

        reponse.headers["Location"] = f"{prefixe}{lieu}"
        return reponse
