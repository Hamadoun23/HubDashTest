"""Le cookie qui porte le compte unique d'une application a l'autre.

Le shell de GDA Hub garde son jeton en memoire et l'envoie lui-meme : il n'a
besoin de rien d'autre. Les applications rassemblees, elles, ne connaissent
pas le hub — FinanceRH et Jus d'orange ont leur propre front, BDM sert ses
pages depuis Django. Aucune ne saurait aller chercher un jeton chez lui.

D'ou ce cookie. Il est pose par `identity` a la connexion, sur l'origine
unique de la passerelle, et la passerelle le transforme en en-tete
`Authorization` avant de transmettre la requete a l'application. Celle-ci
n'a donc qu'un en-tete a lire, et le cookie ne quitte jamais le navigateur.

**Pourquoi HttpOnly.** Le JavaScript n'a aucune raison de le lire : c'est la
passerelle qui s'en sert. Le rendre inaccessible au script retire au vol de
jeton par injection son interet principal.

**Pourquoi SameSite=Lax et non Strict.** Lax laisse passer le cookie sur une
navigation entrante — un lien depuis une messagerie vers /rh/absences ouvre
directement la page. Strict obligerait a passer par l'accueil du hub a chaque
fois, sans rien apporter : le cookie ne sert a aucune ecriture directe.

Sa duree de vie est celle du jeton d'acces, et pas davantage : un cookie qui
survivrait a son jeton ferait echouer les requetes sans que personne
comprenne pourquoi.
"""

from django.conf import settings

#: Le nom est prefixe pour ne pas entrer en collision avec les cookies des
#: applications rassemblees, qui partagent la meme origine.
NOM = "gdahub_acces"


def poser(reponse, jeton_acces):
    """Attache le jeton d'acces a la reponse, pour les applications du hub."""
    reponse.set_cookie(
        NOM,
        jeton_acces,
        max_age=settings.GDAHUB_DUREE_ACCES,
        httponly=True,
        # En production, la passerelle est en HTTPS et le cookie ne doit
        # jamais partir en clair. En local, elle est en HTTP simple.
        secure=not settings.DEBUG,
        samesite="Lax",
        # Toutes les applications sont sous la meme origine, a des chemins
        # differents : la racine est la seule portee qui les couvre toutes.
        path="/",
    )
    return reponse


def retirer(reponse):
    """Efface le cookie. Appele a la deconnexion."""
    reponse.delete_cookie(NOM, path="/", samesite="Lax")
    return reponse
