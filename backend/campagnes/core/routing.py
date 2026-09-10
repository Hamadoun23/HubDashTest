"""
Aide à la déclaration des routes « ressource » de Laravel.

`Route::resource('agences', …)` produit six routes nommées dont deux paires
partagent la même URI. Django n'accepte qu'une vue par chemin : on enregistre
donc un aiguilleur par URI, mais on déclare le chemin autant de fois qu'il y a
de noms Laravel — la première déclaration sert au routage, les suivantes
n'existent que pour alimenter la table de routes envoyée au frontend
(cf. core.routes).
"""

from django.urls import path

from .decorators import par_methode


def ressource(base, parametre, *, index=None, create=None, store=None, edit=None,
              update=None, destroy=None, show=None, prefixe_nom=""):
    """
    Déclare les routes d'une ressource à la manière de Laravel.

    `base` est l'URI sans slash final (« admin/agences »), `parametre` le nom du
    paramètre d'URL utilisé côté frontend (« agence »), qui doit correspondre à
    celui employé dans les appels `route()` du JSX.
    """
    nom = lambda action: f"{prefixe_nom}{action}"  # noqa: E731
    motifs = []

    collection = {}
    if index:
        collection["GET"] = index
    if store:
        collection["POST"] = store
    if collection:
        vue = par_methode(**collection)
        if index:
            motifs.append(path(base, vue, name=nom("index")))
        if store:
            motifs.append(path(base, vue, name=nom("store")))

    if create:
        motifs.append(path(f"{base}/create", create, name=nom("create")))

    if edit:
        motifs.append(path(f"{base}/<int:{parametre}>/edit", edit, name=nom("edit")))

    element = {}
    if show:
        element["GET"] = show
    if update:
        element["PUT"] = update
        element["PATCH"] = update
        # Inertia poste les mises à jour avec `_method=PUT` ; l'aiguilleur le gère.
        element.setdefault("POST", update)
    if destroy:
        element["DELETE"] = destroy
        element.setdefault("POST", destroy)
    if element:
        vue = par_methode(**element)
        chemin = f"{base}/<int:{parametre}>"
        if show:
            motifs.append(path(chemin, vue, name=nom("show")))
        if update:
            motifs.append(path(chemin, vue, name=nom("update")))
        if destroy:
            motifs.append(path(chemin, vue, name=nom("destroy")))

    return motifs
