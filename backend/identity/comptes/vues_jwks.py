"""Routes publiques : le jeu de cles et la sonde de sante.

Ces deux vues sont volontairement hors de l'API authentifiee. Le JWKS doit
etre lisible par tous les services avant meme qu'ils aient un jeton, et la
sonde doit repondre a Docker sans credential.
"""

from django.db import connection
from django.http import JsonResponse

from comptes import jetons


def jwks(requete):
    """La cle publique, au format standard attendu par les bibliotheques JWT.

    Ne contient jamais la cle privee : seuls le modulus et l'exposant public
    en sortent.
    """
    reponse = JsonResponse(jetons.jeu_de_cles())
    # Les services mettent le document en cache ; la duree est courte pour
    # qu'une rotation de cle se propage en quelques minutes.
    reponse["Cache-Control"] = "public, max-age=300"
    return reponse


def sante(requete):
    """Etat du service : le processus repond et la base est joignable."""
    try:
        with connection.cursor() as curseur:
            curseur.execute("SELECT 1")
        base = "ok"
        code = 200
    except Exception as erreur:  # noqa: BLE001 - on veut le motif dans la reponse
        base = f"indisponible : {erreur}"
        code = 503
    return JsonResponse({"service": "identity", "base": base}, status=code)
