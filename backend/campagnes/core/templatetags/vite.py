"""
Intégration Vite — équivalent des directives Blade `@vite` et `@viteReactRefresh`.

En développement, les assets sont servis par le serveur Vite du dossier
`frontend/` (rechargement à chaud). En production, ils sont lus dans
`frontend/dist` via le manifeste généré par `vite build`.
"""

import json
from functools import lru_cache

from django import template
from django.conf import settings
from django.utils.safestring import mark_safe

register = template.Library()

#: Points d'entrée déclarés dans frontend/vite.config.js.
ENTREES = ["src/app.jsx"]


@lru_cache(maxsize=1)
def _manifeste():
    chemin = settings.VITE_MANIFEST_PATH
    if not chemin.exists():
        raise RuntimeError(
            f"Manifeste Vite introuvable ({chemin}). "
            "Lancez `npm run build` dans frontend/, ou activez VITE_DEV=true."
        )
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


@register.simple_tag
def vite_react_refresh():
    """Préambule exigé par @vitejs/plugin-react avant tout module React."""
    if not settings.VITE_DEV:
        return ""
    return mark_safe(
        f"""<script type="module">
  import RefreshRuntime from '{settings.VITE_DEV_SERVER}/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {{}}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>"""
    )


@register.simple_tag
def vite_assets():
    """Balises <script> et <link> des points d'entrée du frontend."""
    if settings.VITE_DEV:
        balises = [
            f'<script type="module" src="{settings.VITE_DEV_SERVER}/@vite/client"></script>'
        ]
        balises += [
            f'<script type="module" src="{settings.VITE_DEV_SERVER}/{entree}"></script>'
            for entree in ENTREES
        ]
        return mark_safe("\n".join(balises))

    manifeste = _manifeste()
    balises = []
    feuilles_vues = set()

    for entree in ENTREES:
        bloc = manifeste.get(entree)
        if bloc is None:
            continue
        balises.append(
            f'<script type="module" src="{settings.STATIC_URL}{bloc["file"]}"></script>'
        )
        # Les CSS extraits du bundle doivent être chargés avant le script pour
        # éviter le flash de page non stylée.
        for css in bloc.get("css", []):
            if css not in feuilles_vues:
                feuilles_vues.add(css)
                balises.insert(
                    0, f'<link rel="stylesheet" href="{settings.STATIC_URL}{css}">'
                )

    return mark_safe("\n".join(balises))
