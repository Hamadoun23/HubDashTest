"""
Middlewares transverses.

- `EnsureCompteActifMiddleware` : portage de App\\Http\\Middleware\\EnsureCompteActif.
- `InertiaSharedDataMiddleware` : portage de App\\Http\\Middleware\\HandleInertiaRequests::share().
"""

import json

from django.contrib.auth import logout
from django.http import QueryDict
from django.shortcuts import redirect

from .auth_backend import MESSAGE_COMPTE_DESACTIVE, compte_desactive

#: Clé de session où sont déposées les erreurs de validation entre deux
#: requêtes, à la manière du `withErrors()` de Laravel. Elles ressortent dans
#: la prop Inertia `errors`, que le frontend lit déjà.
CLE_ERREURS = "_inertia_errors"

#: Messages flash (succès, avertissement…), équivalents de `session()->flash()`.
CLE_FLASH = "_inertia_flash"

#: Laravel expose systématiquement ces cinq clés, à `null` quand il n'y a rien.
#: On reproduit cette forme pour que les props soient strictement identiques.
CLES_FLASH = ("success", "error", "warning", "status", "success_article")


def deposer_erreurs(request, **erreurs):
    request.session[CLE_ERREURS] = {
        champ: str(message) for champ, message in erreurs.items()
    }


def retour_avec_erreurs(request, erreurs):
    """
    Équivalent de `back()->withErrors($erreurs)->withInput()`.

    Inertia renvoie l'utilisateur sur la page précédente ; les erreurs sont
    lues par `useForm` via la prop partagée `errors`. Les anciennes valeurs
    n'ont pas besoin d'être renvoyées : le formulaire React conserve son état.
    """
    from django.shortcuts import redirect

    request.session[CLE_ERREURS] = {
        champ: str(message) for champ, message in erreurs.items()
    }
    return redirect(request.META.get("HTTP_REFERER") or "/")


def deposer_flash(request, **messages):
    flash = request.session.get(CLE_FLASH, {})
    flash.update({cle: str(valeur) for cle, valeur in messages.items()})
    request.session[CLE_FLASH] = flash


class CorpsJsonMiddleware:
    """
    Rend les corps JSON lisibles via `request.POST`.

    Inertia envoie les formulaires en `application/json` dès qu'ils ne
    contiennent aucun fichier. Django, lui, ne remplit `request.POST` que pour
    les corps `form-urlencoded` et `multipart` : sans ce middleware, tous les
    champs arrivent vides et chaque formulaire échoue silencieusement.

    Les objets imbriqués sont aplatis en clés pointées (`propose.3`), comme le
    fait `$request->input('propose.3')` côté Laravel.

    Ce middleware doit précéder `CsrfViewMiddleware` : celui-ci lit `request.POST`
    pour y chercher `csrfmiddlewaretoken`, et toute lecture du flux avant nous
    rendrait `request.body` inaccessible.
    """

    #: Méthodes dont le corps peut porter des données de formulaire.
    METHODES = ("POST", "PUT", "PATCH", "DELETE")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in self.METHODES:
            type_contenu = (request.content_type or "").lower()

            if type_contenu == "application/json" and request.body:
                self._remplacer_post(request, self._depuis_json(request.body))
            elif (
                request.method != "POST"
                and type_contenu == "application/x-www-form-urlencoded"
            ):
                # Django ne décode le corps que pour les POST ; les PUT et PATCH
                # d'Inertia doivent l'être aussi.
                self._remplacer_post(request, QueryDict(request.body))

        return self.get_response(request)

    def _remplacer_post(self, request, donnees):
        from django.utils.datastructures import MultiValueDict

        request._post = donnees
        request._files = MultiValueDict()

    def _depuis_json(self, corps):
        try:
            donnees = json.loads(corps)
        except (ValueError, UnicodeDecodeError):
            return QueryDict(mutable=True)

        parametres = QueryDict(mutable=True)
        if not isinstance(donnees, dict):
            return parametres

        for cle, valeur in donnees.items():
            if isinstance(valeur, (list, tuple)):
                parametres.setlist(cle, [self._texte(v) for v in valeur])
            elif isinstance(valeur, dict):
                for sous_cle, sous_valeur in valeur.items():
                    parametres[f"{cle}.{sous_cle}"] = self._texte(sous_valeur)
            else:
                parametres[cle] = self._texte(valeur)
        return parametres

    def _texte(self, valeur):
        """Ramène la valeur JSON à ce qu'un formulaire HTML aurait transmis."""
        if valeur is None:
            return ""
        if isinstance(valeur, bool):
            # Une case cochée vaut « 1 », une case décochée n'est pas envoyée.
            return "1" if valeur else ""
        return str(valeur)


class EnsureCompteActifMiddleware:
    """Déconnecte un compte désactivé et renvoie vers la page de connexion."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated and compte_desactive(user):
            logout(request)
            request.session.flush()
            request.session[CLE_ERREURS] = {"email": MESSAGE_COMPTE_DESACTIVE}
            return redirect("/login")
        return self.get_response(request)


class ChoixClientRequisMiddleware:
    """
    Impose le choix d'un client de GDA aux comptes qui en pilotent plusieurs.

    Sans partenaire courant, les écrans d'administration filtreraient sur
    `None` et n'afficheraient rien, sans que l'utilisateur comprenne pourquoi.
    La garde est posée ici plutôt que vue par vue : une vue ajoutée demain est
    couverte sans qu'on ait à y penser.
    """

    #: Chemins accessibles sans avoir choisi : authentification, écran de choix
    #: lui-même, profil et ressources techniques.
    #:
    #: Les fichiers servis à la racine (cf. `public.racine` dans config/urls.py)
    #: en font partie : rediriger `/sw.js` vers une page HTML fait échouer
    #: l'enregistrement du service worker, précisément sur l'écran de choix où
    #: le navigateur le tente.
    PREFIXES_LIBRES = (
        "/login",
        "/logout",
        "/choix-client",
        "/password",
        "/forgot-password",
        "/reset-password",
        "/confirm-password",
        "/verify-email",
        "/email/",
        "/profile",
        "/static/",
        "/storage/",
        "/site.webmanifest",
        "/sw.js",
        "/sante",
        "/logo/",
        "/favicon.ico",
        "/robots.txt",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from .partenaires import URL_CHOIX, partenaire_courant

        user = getattr(request, "user", None)
        if (
            user is not None
            and user.is_authenticated
            and user.choisit_son_partenaire
            # `path_info` et non `path` : le second porte le prefixe sous
            # lequel l'application est servie (« /bdm/login »), et ne
            # correspondrait plus a cette liste. L'ecran de connexion serait
            # alors lui-meme redirige vers l'ecran de choix, en boucle.
            and not request.path_info.startswith(self.PREFIXES_LIBRES)
            and partenaire_courant(request) is None
        ):
            return redirect(URL_CHOIX)
        return self.get_response(request)


class InertiaSharedDataMiddleware:
    """
    Props partagées avec toutes les pages Inertia : utilisateur courant,
    messages flash et erreurs de validation.

    `peut_vendre` / `peut_enroler` conditionnent l'affichage des tunnels de
    saisie côté React : un commercial ne peut saisir que s'il est réellement
    engagé sur une campagne ouverte du type correspondant.

    `client` porte le partenaire courant — le client de GDA dont on regarde les
    données. Toutes les pages en ont besoin : le sélecteur de la barre latérale
    l'affiche, et plusieurs écrans masquent la notion d'agence quand le
    partenaire n'en a pas.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from inertia import share

        share(
            request,
            auth=lambda: {"user": self._utilisateur(request)},
            client=lambda: self._client(request),
            flash=lambda: self._flash(request),
            errors=lambda: request.session.pop(CLE_ERREURS, {}) or {},
        )
        return self.get_response(request)

    def _client(self, request):
        """Partenaire courant et liste de ceux entre lesquels basculer."""
        from .partenaires import partenaire_courant, partenaires_accessibles

        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None

        courant = partenaire_courant(request)
        accessibles = partenaires_accessibles(user)

        return {
            "courant": self._partenaire(courant),
            "disponibles": [self._partenaire(p) for p in accessibles],
            # Seuls l'administration et la direction peuvent changer de client.
            "peut_changer": bool(user.choisit_son_partenaire and len(accessibles) > 1),
        }

    def _partenaire(self, partenaire):
        if partenaire is None:
            return None
        return {
            "id": partenaire.id,
            "code": partenaire.code,
            "nom": partenaire.nom,
            "nom_complet": partenaire.nom_complet,
            "organisation": partenaire.organisation,
            "a_des_agences": partenaire.a_des_agences,
            "fiche_adhesion": bool(partenaire.fiche_adhesion),
        }

    def _flash(self, request):
        depose = request.session.pop(CLE_FLASH, {}) or {}
        return {cle: depose.get(cle) for cle in CLES_FLASH}

    def _utilisateur(self, request):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None

        return {
            "id": user.id,
            "name": user.name,
            "prenom": user.prenom,
            "role": user.role,
            "agence_id": user.agence_id,
            "partenaire_id": user.partenaire_id,
            "is_admin": user.is_admin,
            "is_direction": user.is_direction,
            "is_commercial": user.is_commercial,
            "is_commercial_telephonique": user.is_commercial_telephonique,
            "peut_vendre": self._campagne_ouverte_engagee(user, "vente_carte"),
            "peut_enroler": self._campagne_ouverte_engagee(user, "enrolement_app"),
            # Deposee en session par `core.hub` a l'ouverture de la session
            # SSO — absente pour qui s'est connecte directement, sans passer
            # par le hub.
            "photo": request.session.get("hub_photo"),
        }

    def _campagne_ouverte_engagee(self, user, type_campagne) -> bool:
        """
        Le commercial a-t-il une campagne ouverte de ce type où il est engagé ?

        Le rattachement passe par l'agence chez un partenaire qui en a, par le
        partenaire lui-même sinon : c'est `actives_pour_commercial` qui tranche.
        """
        if not user.is_commercial:
            return False

        from campagnes.models import Campagne

        return any(
            campagne.est_engage_commercial(user.id)
            for campagne in Campagne.actives_pour_commercial(user).filter(
                type=type_campagne
            )
        )
