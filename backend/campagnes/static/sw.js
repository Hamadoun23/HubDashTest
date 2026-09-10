/**
 * Service Worker — Gda Money PWA
 *
 * Met en cache les ressources immuables : le logo et les assets compiles par
 * Vite, dont le nom porte un hachage de contenu. Les pages et les appels
 * Inertia ne sont jamais servis depuis le cache : ils doivent toujours
 * refleter l'etat reel des campagnes.
 *
 * ## Deux prefixes, et pourquoi ils ne se deduisent pas l'un de l'autre
 *
 * Un service worker ne pilote que ce qui vit sous son propre dossier. Servi
 * depuis « /campagnes/static/sw.js », il ne pouvait pas prendre « / » pour
 * portee : le navigateur refusait l'enregistrement, l'erreur partait dans un
 * `.catch()` vide, et la PWA n'existait pas. Django le sert donc a la racine
 * de l'application — « /campagnes/sw.js » — d'ou se deduit `BASE`.
 *
 * Mais les fichiers statiques, eux, ne sont pas sous cette racine : ils
 * viennent de STATIC_URL, que seul Django connait. Il le passe en parametre
 * de l'adresse d'enregistrement. Les deux valeurs coincident quand
 * l'application est servie a la racine ; sous la passerelle du hub, non.
 */
const ADRESSE = new URL(self.location.href);

/** La racine de l'application : « » a la racine, « /campagnes » sous le hub. */
const BASE = ADRESSE.pathname.replace(/\/?sw\.js$/i, '');

/** Le prefixe des fichiers statiques, tel que Django le declare. */
const STATIQUE = (ADRESSE.searchParams.get('statique') || `${BASE}/static/`).replace(/\/?$/, '/');

// Version incrementee a chaque changement de strategie : l'ancien cache est
// supprime a l'activation. La v3 corrige les prefixes ci-dessus ; les entrees
// de la v2, calculees a partir du mauvais dossier, ne valent plus rien.
const CACHE_NAME = 'gda-money-static-v3';

// Uniquement des ressources dont l'existence est certaine — et chacune est
// ajoutee separement, pour qu'une absence n'empeche pas l'installation.
const PRECACHE_URLS = [
    `${STATIQUE}logo/iconesgda.png`,
    `${STATIQUE}logo/gdamoney.png`,
    `${STATIQUE}logo/gdamoney-mark.png`,
];

// Ce qui est immuable, et rien d'autre : le nom de ces fichiers porte un
// hachage de contenu, donc une version en cache ne peut jamais etre perimee.
const PREFIXES_CACHABLES = [`${STATIQUE}logo/`, `${STATIQUE}assets/`];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) =>
                Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)))
            )
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') {
        return;
    }
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return;
    }
    if (!PREFIXES_CACHABLES.some((prefixe) => url.pathname.startsWith(prefixe))) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(request).then((response) => {
                if (response.ok) {
                    const copie = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
                }
                return response;
            });
        })
    );
});
