/**
 * Noyau du pont Inertia de Campagnes dans GDA Hub.
 *
 * Les pages de BDM (Campagnes GDA) sont reprises telles quelles : elles
 * importent `Head`, `Link`, `router`, `useForm`, `usePage` depuis
 * `@inertiajs/react` et appellent `route()` (Ziggy). Dans le hub, il n'y a ni
 * gabarit Django ni application Inertia : l'interface est celle du hub
 * (HashRouter), et le service Campagnes est lu en JSON grâce au protocole
 * Inertia (`X-Inertia: true`). Ce module fait le lien :
 *
 * - une adresse du service (`/campagnes/ventes?page=2`) correspond une à une
 *   à une route du hub (`#/campagnes/ventes?page=2`) ;
 * - une visite = une requête Inertia, dont la réponse `{component, props, url}`
 *   est affichée par `HoteCampagnes` ;
 * - `window.route` est construit à partir de la table servie par
 *   `/campagnes/ziggy.json`, et `window.axios` pointe vers le service.
 */
import axios from 'axios';
import { route as ziggyRoute } from 'ziggy-js';
import { jetonAcces } from '../../lib/api/client';
import { BASE } from '../../lib/api/campagnesClient';

/** Préfixe des routes du hub qui affichent Campagnes. */
export const PREFIXE_HUB = '/campagnes';

const CSRF_COOKIE = 'campagnes_csrftoken';

function lireCookie(nom) {
    const trouve = document.cookie.split('; ').find((c) => c.startsWith(`${nom}=`));
    return trouve ? decodeURIComponent(trouve.split('=').slice(1).join('=')) : null;
}

// Un ancien cookie CSRF posé sur « /campagnes/ » (avant CSRF_COOKIE_PATH=/)
// serait envoyé avant le nouveau et fausserait la vérification : on l'expire.
document.cookie = `${CSRF_COOKIE}=; path=${BASE}/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

// --- Adresses ------------------------------------------------------------

/**
 * Ramène une adresse quelconque (absolue, relative, avec ou sans le préfixe
 * du service) au chemin du service, sans le préfixe : `/ventes?page=2`.
 * Renvoie `null` pour une adresse qui sort du service (autre origine).
 */
export function cheminService(url) {
    if (!url) return null;
    let u;
    try {
        u = new URL(url, window.location.origin);
    } catch {
        return null;
    }
    if (u.origin !== window.location.origin) return null;
    let chemin = u.pathname;
    if (chemin === BASE || chemin.startsWith(`${BASE}/`)) chemin = chemin.slice(BASE.length);
    if (!chemin.startsWith('/')) chemin = `/${chemin}`;
    return chemin + u.search;
}

/** Route du hub qui affiche cette adresse du service. */
export function cheminHub(url) {
    const chemin = cheminService(url);
    return chemin === null ? null : PREFIXE_HUB + (chemin === '/' ? '' : chemin);
}

/** Adresse réelle du service (pour un téléchargement, un nouvel onglet). */
export function urlService(url) {
    const chemin = cheminService(url);
    return chemin === null ? url : BASE + chemin;
}

// --- Ziggy -----------------------------------------------------------------

let ziggy = null;
let chargementZiggy = null;
let emplacement = { pathname: `${BASE}/dashboard`, search: '' };

/** Emplacement courant côté service, lu par `route().current()`. */
export function definirEmplacement(url) {
    const chemin = cheminService(url) ?? '/dashboard';
    const [pathname, search = ''] = chemin.split('?');
    emplacement = { pathname: BASE + pathname, search: search ? `?${search}` : '' };
}

window.route = (name, params, absolute) =>
    ziggyRoute(name, params, absolute, {
        ...(ziggy ?? { url: window.location.origin + BASE, port: null, defaults: {}, routes: {} }),
        location: { host: window.location.host, ...emplacement },
    });

export function chargerZiggy() {
    if (ziggy) return Promise.resolve(ziggy);
    if (!chargementZiggy) {
        chargementZiggy = fetch(`${BASE}/ziggy.json`, { credentials: 'include', headers: entetesAuth() })
            .then((r) => {
                if (!r.ok) throw new Error(`Table de routes indisponible (${r.status})`);
                return r.json();
            })
            .then((table) => {
                // Les routes sont servies avec l'origine vue par le service ;
                // on garde celle du navigateur, qui est la seule fiable derrière
                // la passerelle.
                ziggy = { ...table, url: window.location.origin + BASE, port: window.location.port || null };
                return ziggy;
            })
            .catch((e) => {
                chargementZiggy = null;
                throw e;
            });
    }
    return chargementZiggy;
}

// --- Requêtes --------------------------------------------------------------

function entetesAuth() {
    const jeton = jetonAcces();
    return jeton ? { Authorization: `Bearer ${jeton}` } : {};
}

async function assurerCsrf() {
    if (!lireCookie(CSRF_COOKIE)) {
        await fetch(`${BASE}/ziggy.json`, { credentials: 'include', headers: entetesAuth() }).catch(() => undefined);
    }
    return lireCookie(CSRF_COOKIE);
}

function contientFichier(valeur) {
    if (valeur instanceof File || valeur instanceof Blob || valeur instanceof FileList) return true;
    if (Array.isArray(valeur)) return valeur.some(contientFichier);
    if (valeur && typeof valeur === 'object') return Object.values(valeur).some(contientFichier);
    return false;
}

/** Aplatit `data` en FormData, clés à crochets comme Inertia (`a[0]`, `b[c]`). */
function versFormData(data, fd = new FormData(), prefixe = '') {
    Object.entries(data ?? {}).forEach(([cle, valeur]) => {
        const nom = prefixe ? `${prefixe}[${cle}]` : cle;
        if (valeur === undefined) return;
        if (valeur instanceof FileList) Array.from(valeur).forEach((f, i) => fd.append(`${nom}[${i}]`, f));
        else if (valeur instanceof File || valeur instanceof Blob) fd.append(nom, valeur);
        else if (Array.isArray(valeur)) {
            valeur.forEach((v, i) => {
                if (v !== null && typeof v === 'object' && !(v instanceof File)) versFormData(v, fd, `${nom}[${i}]`);
                else fd.append(`${nom}[${i}]`, v === null ? '' : v instanceof File ? v : String(v));
            });
        } else if (valeur !== null && typeof valeur === 'object') versFormData(valeur, fd, nom);
        else if (typeof valeur === 'boolean') fd.append(nom, valeur ? '1' : '0');
        else fd.append(nom, valeur === null ? '' : String(valeur));
    });
    return fd;
}

/** Sérialise `data` en chaîne de requête, tableaux à crochets (`ids[]=1`). */
function versQuery(data, params = new URLSearchParams(), prefixe = '') {
    Object.entries(data ?? {}).forEach(([cle, valeur]) => {
        const nom = prefixe ? `${prefixe}[${cle}]` : cle;
        if (valeur === undefined || valeur === null || valeur === '') return;
        if (Array.isArray(valeur)) valeur.forEach((v) => params.append(`${nom}[]`, v));
        else if (typeof valeur === 'object') versQuery(valeur, params, nom);
        else params.append(nom, typeof valeur === 'boolean' ? (valeur ? '1' : '0') : String(valeur));
    });
    return params;
}

/** Adresse d'une visite GET : les données passent dans la chaîne de requête. */
export function urlAvecDonnees(url, data) {
    const chemin = cheminService(url) ?? '/';
    if (!data || Object.keys(data).length === 0) return chemin;
    const [pathname, search = ''] = chemin.split('?');
    const params = new URLSearchParams(search);
    const ajout = versQuery(data);
    // Comme Inertia : les données remplacent les paramètres homonymes.
    new Set(ajout.keys()).forEach((k) => params.delete(k));
    ajout.forEach((v, k) => params.append(k, v));
    const qs = params.toString();
    return pathname + (qs ? `?${qs}` : '');
}

export class ErreurCampagnes extends Error {
    constructor(message, statut) {
        super(message);
        this.statut = statut;
    }
}

/**
 * Exécute une requête Inertia contre le service et renvoie la page reçue.
 * `{ externe: url }` quand le service demande une sortie hors Inertia
 * (409 + X-Inertia-Location, ou réponse qui n'est pas une page).
 */
export async function requeteInertia(url, { method = 'get', data, forceFormData = false } = {}) {
    method = method.toLowerCase();
    const chemin = method === 'get' ? urlAvecDonnees(url, data) : cheminService(url) ?? '/';

    const entetes = {
        'X-Inertia': 'true',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'text/html, application/xhtml+xml',
        ...entetesAuth(),
    };

    let corps;
    let methodeHttp = method.toUpperCase();
    if (method !== 'get') {
        const csrf = await assurerCsrf();
        if (csrf) entetes['X-CSRFToken'] = csrf;
        if (forceFormData || contientFichier(data)) {
            const fd = versFormData(data);
            // Django ne lit pas un multipart en PUT/PATCH : comme Inertia, on
            // envoie un POST — les vues d'écriture acceptent POST partout.
            if (method !== 'post') {
                fd.append('_method', method);
                methodeHttp = 'POST';
            }
            corps = fd;
        } else if (data !== undefined) {
            entetes['Content-Type'] = 'application/json';
            corps = JSON.stringify(data);
        }
    }

    const reponse = await fetch(BASE + chemin, {
        method: methodeHttp,
        headers: entetes,
        credentials: 'include',
        body: corps,
        // La page d'où part la requête, comme le ferait le navigateur dans BDM.
        // Les vues redirigent « en arrière » d'après cet en-tête (erreurs de
        // validation, actions depuis une liste) ; depuis le hub, il vaudrait
        // la racine du site (le « #/… » n'est jamais transmis) et la
        // redirection sortirait de l'application.
        referrer: window.location.origin + emplacement.pathname + emplacement.search,
    });

    // Redirigée hors du service malgré tout (en-tête Referer absent, ancienne
    // redirection en dur) : rien d'affichable, l'appelant recharge la page.
    const arrivee = new URL(reponse.url || window.location.href);
    if (reponse.redirected && !(arrivee.pathname === BASE || arrivee.pathname.startsWith(`${BASE}/`))) {
        return { horsService: true };
    }

    if (reponse.status === 409 && reponse.headers.get('X-Inertia-Location')) {
        return { externe: reponse.headers.get('X-Inertia-Location') };
    }
    if (reponse.headers.get('X-Inertia') === 'true' || (reponse.headers.get('Content-Type') ?? '').includes('application/json')) {
        const page = await reponse.json().catch(() => null);
        if (page && page.component) return { page };
        if (!reponse.ok) throw new ErreurCampagnes(page?.message ?? `Erreur ${reponse.status}`, reponse.status);
    }
    if (!reponse.ok) {
        const messages = {
            403: "Vous n'avez pas accès à cette page.",
            404: 'Page introuvable.',
            419: 'Session expirée — rechargez la page.',
            500: 'Erreur du service Campagnes.',
        };
        throw new ErreurCampagnes(messages[reponse.status] ?? `Erreur ${reponse.status}`, reponse.status);
    }
    // Une réponse qui n'est pas une page Inertia (fichier, HTML) : on la
    // laisse au navigateur.
    return { externe: reponse.url || BASE + chemin };
}

// --- axios (écritures JSON des ventes et enrôlements) ---------------------

const client = axios.create({
    baseURL: BASE,
    withCredentials: true,
    xsrfCookieName: CSRF_COOKIE,
    xsrfHeaderName: 'X-CSRFToken',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
});
client.interceptors.request.use(async (config) => {
    Object.assign(config.headers, entetesAuth());
    const methode = (config.method ?? 'get').toLowerCase();
    if (methode !== 'get') {
        const csrf = await assurerCsrf();
        if (csrf) config.headers['X-CSRFToken'] = csrf;
    }
    // `/campagnes/api/...` et non `/api/...` : une adresse absolue écrite dans
    // une page désigne le service, pas la racine du site.
    if (config.url && config.url.startsWith(`${BASE}/`)) config.url = config.url.slice(BASE.length);
    return config;
});
window.axios = client;
