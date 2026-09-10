"""
Vues du socle : connexion, déconnexion, choix du client, manifeste PWA.

Portage de App\\Http\\Controllers\\Auth\\AuthenticatedSessionController et de la
route `pwa.manifest` de routes/web.php.
"""

from datetime import datetime

from django.conf import settings
from django.contrib.auth import login as ouvrir_session
from django.contrib.auth import logout as fermer_session
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.templatetags.static import static
from django.views.decorators.csrf import csrf_protect
from inertia import render

from . import throttling
from .auth_backend import (
    MESSAGE_ECHEC,
    LaravelBcryptBackend,
    MESSAGE_COMPTE_DESACTIVE,
    compte_desactive,
)
from .decorators import http_methods
from .middleware import deposer_erreurs, deposer_flash
from .models import UserLoginLog
from .partenaires import definir_partenaire, partenaire_courant, partenaires_accessibles

BACKEND_AUTH = "core.auth_backend.LaravelBcryptBackend"


def _ip(request) -> str:
    transmise = request.META.get("HTTP_X_FORWARDED_FOR")
    if transmise:
        return transmise.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


@csrf_protect
@http_methods("GET", "HEAD", "POST")
def login(request):
    """
    Laravel déclare deux routes sur `login` (GET pour l'affichage, POST pour la
    soumission) dont seule la première est nommée. Django n'accepte qu'une vue
    par chemin : on aiguille donc sur la méthode.
    """
    if request.method == "POST":
        return _login_store(request)
    if request.user.is_authenticated:
        return redirect("/dashboard")
    return render(
        request, "Auth/Login", {"status": request.session.pop("status", None)}
    )


def _login_store(request):
    identifiant = (request.POST.get("email") or "").strip()
    mot_de_passe = request.POST.get("password") or ""
    ip = _ip(request)

    secondes = throttling.trop_de_tentatives(identifiant, ip)
    if secondes:
        deposer_erreurs(
            request,
            email=f"Trop de tentatives de connexion. Veuillez réessayer dans {secondes} secondes.",
        )
        return redirect("/login")

    user = LaravelBcryptBackend().authenticate(
        request, username=identifiant, password=mot_de_passe
    )

    if user is None:
        throttling.enregistrer_echec(identifiant, ip)
        deposer_erreurs(request, email=MESSAGE_ECHEC)
        return redirect("/login")

    # Laravel ouvre la session puis la referme si le compte est désactivé ;
    # le résultat visible est identique et l'ordre n'a pas d'effet de bord ici.
    if compte_desactive(user):
        deposer_erreurs(request, email=MESSAGE_COMPTE_DESACTIVE)
        return redirect("/login")

    throttling.reinitialiser(identifiant, ip)
    ouvrir_session(request, user, backend=BACKEND_AUTH)
    request.session.cycle_key()

    UserLoginLog.objects.create(
        user=user,
        logged_in_at=datetime.now().replace(microsecond=0),
        ip_address=ip or None,
        user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:512] or None,
    )

    suivante = request.session.pop("url_demandee", None)
    if suivante:
        return redirect(suivante)
    # Un compte qui pilote plusieurs clients de GDA choisit d'abord lequel il
    # consulte ; le tableau de bord n'aurait sinon aucun périmètre à afficher.
    if user.choisit_son_partenaire:
        return redirect("partenaires.choix")
    return redirect("/dashboard")


@csrf_protect
@http_methods("POST")
def logout_store(request):
    fermer_session(request)
    request.session.flush()
    return redirect("/")


@http_methods("GET", "HEAD")
def racine(request):
    return redirect("/dashboard" if request.user.is_authenticated else "/login")


@csrf_protect
@http_methods("GET", "HEAD", "POST")
def choix_client(request):
    """
    Écran de sélection du client de GDA — BDM, UBA…

    Il s'affiche à la connexion des comptes d'administration et de direction,
    et reste accessible en permanence pour basculer d'un client à l'autre.
    Les commerciaux n'y ont rien à faire : leur périmètre est celui de leur
    compte.
    """
    user = request.user
    if not user.is_authenticated:
        return redirect("/login")
    if not user.choisit_son_partenaire:
        return redirect("/dashboard")

    accessibles = partenaires_accessibles(user)

    if request.method == "POST":
        demande = request.POST.get("partenaire_id")
        choisi = next(
            (p for p in accessibles if str(p.id) == str(demande)), None
        )
        if choisi is None:
            deposer_erreurs(request, partenaire_id="Client inconnu ou indisponible.")
            return redirect("partenaires.choix")
        definir_partenaire(request, choisi)
        deposer_flash(request, success=f"Client sélectionné : {choisi.nom}.")
        return redirect("/dashboard")

    courant = partenaire_courant(request)
    return render(
        request,
        "Partenaires/Choix",
        {
            "partenaires": [
                {
                    "id": p.id,
                    "code": p.code,
                    "nom": p.nom,
                    "nom_complet": p.nom_complet,
                    "organisation": p.organisation,
                    "campagnes_actives": p.campagnes.filter(actif=True).count(),
                    "commerciaux": p.utilisateurs.filter(actif=True).count(),
                    "agences": p.agences.count() if p.a_des_agences else 0,
                }
                for p in accessibles
            ],
            "courantId": courant.id if courant else None,
        },
    )


@http_methods("GET", "HEAD")
def manifeste_pwa(request):
    """Manifeste PWA — portage de la route `pwa.manifest` de routes/web.php."""
    icone = request.build_absolute_uri(static("logo/iconesgda.png"))
    nom = settings.APP_NAME

    # La racine de l'application, pas celle du site. Figee sur « / », elle
    # ouvrait l'accueil du hub : l'application installee sur le telephone
    # d'un commercial ne montrait pas ses campagnes.
    racine_app = f"{settings.CHEMIN_BASE}/"

    return JsonResponse(
        {
            "name": nom,
            "short_name": nom,
            "description": "Application de gestion des ventes de cartes et du suivi des performances.",
            "start_url": racine_app,
            "scope": racine_app,
            "display": "standalone",
            "display_override": ["standalone", "minimal-ui", "browser"],
            "background_color": "#381419",
            "theme_color": "#FF6A3A",
            "lang": "fr",
            "dir": "ltr",
            "orientation": "any",
            "icons": [
                {"src": icone, "sizes": "192x192", "type": "image/png", "purpose": "any"},
                {"src": icone, "sizes": "512x512", "type": "image/png", "purpose": "any"},
                {"src": icone, "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
            ],
        },
        content_type="application/manifest+json; charset=UTF-8",
        json_dumps_params={"ensure_ascii": False},
    )


@http_methods("GET", "HEAD")
def service_worker(request):
    """Le service worker de la PWA, servi a la racine de l'application.

    Un navigateur limite la portee d'un service worker au dossier d'ou il est
    telecharge. Servi sous « /campagnes/static/sw.js », il ne pouvait pas
    couvrir « /campagnes/ » : l'enregistrement echouait, silencieusement, et
    l'application n'etait pas installable.

    Le fichier est lu dans `static/` plutot que dans `STATIC_ROOT` : c'est la
    source, elle existe toujours, et elle ne depend pas d'un `collectstatic`
    prealable.
    """
    contenu = (settings.BASE_DIR / "static" / "sw.js").read_text(encoding="utf-8")
    reponse = HttpResponse(contenu, content_type="text/javascript; charset=UTF-8")
    # Sans cache : le worker est le seul fichier qui doit pouvoir changer de
    # strategie sans attendre l'expiration d'un cache.
    reponse["Cache-Control"] = "no-cache"
    return reponse


@http_methods("GET", "HEAD")
def sante(request):
    """Etat du service : le processus repond et la base est joignable.

    Meme forme que chez identity et Jus d'orange : la supervision interroge les
    quatre services de la meme facon. Repondre 200 sur un processus vivant mais
    coupe de sa base serait pire que ne rien repondre — on interroge donc la
    base, et son inaccessibilite fait un 503.
    """
    from django.db import connection

    try:
        with connection.cursor() as curseur:
            curseur.execute("SELECT 1")
        base = "ok"
        code = 200
    except Exception as erreur:  # noqa: BLE001 - on veut le motif dans la reponse
        base = f"indisponible : {erreur}"
        code = 503
    return JsonResponse({"service": "campagnes", "base": base}, status=code)
