"""
Pagination au format Laravel.

Le composant `Components/ui/Pagination.jsx` consomme la structure produite par
`LengthAwarePaginator::linkCollection()` : une liste de `{url, label, active}`
commençant par « Précédent » et finissant par « Suivant », avec des « … » aux
ruptures. L'algorithme de fenêtrage est celui de Laravel (UrlWindow), reproduit
ici pour que les props soient identiques page par page.
"""

from urllib.parse import urlencode

from django.core.paginator import Paginator

#: Nombre de pages affichées de part et d'autre de la page courante.
ON_EACH_SIDE = 3

LIBELLE_PRECEDENT = "&laquo; Précédent"
LIBELLE_SUIVANT = "Suivant &raquo;"
SEPARATEUR = "..."


def _url(request, page):
    """
    URL absolue de la page, filtres courants conservés (`withQueryString`).

    Laravel produit des URL absolues, et ré-encode les tableaux avec des index
    explicites : `campagne_ids[]=8&campagne_ids[]=5` ressort en
    `campagne_ids[0]=8&campagne_ids[1]=5` (comportement de `http_build_query`).
    Un paramètre scalaire répété, lui, ne garde que sa dernière valeur — c'est
    ainsi que PHP interprète la chaîne de requête.
    """
    couples = []
    for cle, valeurs in request.GET.lists():
        if cle == "page":
            continue
        if cle.endswith("[]"):
            racine = cle[:-2]
            couples += [(f"{racine}[{i}]", v) for i, v in enumerate(valeurs)]
        else:
            couples.append((cle, valeurs[-1]))
    couples.append(("page", page))

    return request.build_absolute_uri(f"{request.path}?{urlencode(couples)}")


def _fenetre(page_courante, dernier):
    """
    Numéros de pages à afficher, `None` marquant une rupture « … ».

    Transcription de Illuminate\\Pagination\\UrlWindow. Attention à la taille de
    fenêtre : Laravel utilise `onEachSide + 4`, et non `onEachSide * 2`.
    """
    if dernier < (ON_EACH_SIDE * 2) + 8:
        return list(range(1, dernier + 1))

    fenetre = ON_EACH_SIDE + 4

    # Trop près du début : on déroule le premier bloc, puis les deux dernières pages.
    if page_courante <= fenetre:
        return (
            list(range(1, fenetre + ON_EACH_SIDE + 1))
            + [None]
            + [dernier - 1, dernier]
        )

    # Trop près de la fin : deux premières pages, puis le dernier bloc.
    if page_courante > dernier - fenetre:
        return (
            [1, 2]
            + [None]
            + list(range(dernier - (fenetre + ON_EACH_SIDE - 1), dernier + 1))
        )

    return (
        [1, 2]
        + [None]
        + list(range(page_courante - ON_EACH_SIDE, page_courante + ON_EACH_SIDE + 1))
        + [None]
        + [dernier - 1, dernier]
    )


def paginer(request, queryset, par_page, formateur):
    """
    Pagine `queryset` et renvoie la structure attendue par le frontend.

    `formateur` transforme un objet en dictionnaire de props.
    """
    paginator = Paginator(queryset, par_page)

    try:
        numero = int(request.GET.get("page", 1))
    except (TypeError, ValueError):
        numero = 1
    numero = max(1, min(numero, paginator.num_pages))

    page = paginator.page(numero)
    dernier = paginator.num_pages

    # La clé `page` est présente dans linkCollection() depuis Laravel 11.
    liens = [
        {
            "url": _url(request, numero - 1) if page.has_previous() else None,
            "label": LIBELLE_PRECEDENT,
            "page": numero - 1 if page.has_previous() else None,
            "active": False,
        }
    ]
    for element in _fenetre(numero, dernier):
        if element is None:
            # Le séparateur de Laravel ne porte pas de clé `page`.
            liens.append({"url": None, "label": SEPARATEUR, "active": False})
        else:
            liens.append(
                {
                    "url": _url(request, element),
                    "label": str(element),
                    "page": element,
                    "active": element == numero,
                }
            )
    liens.append(
        {
            "url": _url(request, numero + 1) if page.has_next() else None,
            "label": LIBELLE_SUIVANT,
            "page": numero + 1 if page.has_next() else None,
            "active": False,
        }
    )

    return {
        "data": [formateur(objet) for objet in page.object_list],
        "links": liens,
        "from": page.start_index() if paginator.count else None,
        "to": page.end_index() if paginator.count else None,
        "total": paginator.count,
    }
