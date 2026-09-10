"""Sonde de vie du service.

La passerelle de GDA Hub declare `/sante/jus` pour savoir si le service
repond. L'adresse existait cote nginx mais pas ici : la sonde renvoyait 404,
c'est-a-dire « en panne » pour tout ce qui la lit — un orchestrateur, une
supervision, ou simplement quelqu'un qui verifie avant de deployer.

Repondre 200 sur un processus vivant mais coupe de sa base serait pire que ne
rien repondre : on interroge donc la base, et son inaccessibilite fait un 503.
"""

from django.db import connection
from django.http import JsonResponse


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
    return JsonResponse({"service": "jusorange", "base": base}, status=code)
