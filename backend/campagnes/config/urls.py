"""
Table des URLs — miroir de routes/web.php et routes/auth.php.

Les noms de routes doivent rester strictement identiques à ceux de Laravel :
ils alimentent le helper `route()` du frontend (cf. core.routes).
"""

from django.conf import settings
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("", include("campagnes.urls")),
    path("", include("rapports.urls")),
    path("", include("terrain.urls")),
    path("", include("core.urls")),
    # Fichiers téléversés (pièces d'identité) — équivalent du lien symbolique
    # `storage` de Laravel. En production, nginx sert ce chemin directement ;
    # la vue reste utile en développement et comme filet de sécurité.
    path(
        "storage/<path:path>",
        serve,
        {"document_root": settings.MEDIA_ROOT},
        name="storage.local",
    ),
    # Assets que Laravel servait depuis la racine de `public/`.
    #
    # Les pages React les demandaient en dur — `src="/logo/gdamoney-mark.png"`.
    # Servie a la racine, l'application repondait ; servie sous /campagnes/,
    # cette adresse designe la racine du SITE, pas celle de l'application :
    # le hub y repondait sa page 404 en HTML et les logos restaient casses.
    # Les pages passent desormais par STATIC_URL (cf. lib/statique.js), et
    # ces adresses ne survivent que pour les navigateurs qui gardent en cache
    # une ancienne version des ecrans.
    #
    # `sw.js` n'est plus la : il a sa propre route nommee dans core.urls, qui
    # sert le meme fichier en le declarant a la racine de l'application.
    re_path(
        r"^(?P<path>logo/.+|favicon\.ico|robots\.txt)$",
        serve,
        {"document_root": settings.BASE_DIR / "static"},
        name="public.racine",
    ),
]
