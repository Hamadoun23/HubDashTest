"""
Contrôle d'accès par rôle — équivalent du middleware `role:` de Laravel
(App\\Http\\Middleware\\CheckRole).
"""

from functools import wraps

from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied


def role_required(*roles):
    """
    Restreint la vue aux rôles indiqués.

    Reproduit CheckRole : redirection vers la page de connexion si l'utilisateur
    est anonyme, 403 s'il est connecté mais hors périmètre.
    """

    def decorateur(vue):
        @wraps(vue)
        def _vue(request, *args, **kwargs):
            user = request.user
            if not user.is_authenticated:
                return redirect_to_login(request.get_full_path())
            if user.role not in roles:
                raise PermissionDenied("Accès non autorisé.")
            return vue(request, *args, **kwargs)

        _vue.roles_autorises = roles
        return _vue

    return decorateur


def par_methode(**vues):
    """
    Aiguille une URI vers plusieurs vues selon le verbe HTTP.

    Laravel déclare volontiers deux routes nommées sur la même URI
    (`admin.agences.index` en GET et `admin.agences.store` en POST). Django
    n'accepte qu'une vue par chemin : cet aiguilleur rétablit le comportement.

        par_methode(GET=agences_index, POST=agences_store)
    """

    def _vue(request, *args, **kwargs):
        # Inertia envoie PUT/PATCH/DELETE en POST avec `_method`, comme Blade.
        verbe = request.method
        if verbe == "POST":
            surcharge = (request.POST.get("_method") or "").upper()
            if surcharge in vues:
                verbe = surcharge

        cible = vues.get(verbe) or vues.get("GET" if verbe == "HEAD" else verbe)
        if cible is None:
            from django.http import HttpResponseNotAllowed

            return HttpResponseNotAllowed(sorted(vues))
        return cible(request, *args, **kwargs)

    _vue.http_methods_autorisees = tuple(sorted(vues))
    return _vue


def http_methods(*methodes):
    """
    Restreint les méthodes HTTP acceptées et, surtout, renseigne la table de
    routes envoyée au frontend (cf. core.routes) pour que `route()` produise
    les mêmes URI que Ziggy côté Laravel.
    """

    def decorateur(vue):
        @wraps(vue)
        def _vue(request, *args, **kwargs):
            if request.method not in methodes:
                from django.http import HttpResponseNotAllowed

                return HttpResponseNotAllowed(methodes)
            return vue(request, *args, **kwargs)

        _vue.http_methods_autorisees = methodes
        return _vue

    return decorateur
