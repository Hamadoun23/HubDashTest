/**
 * Service worker de GDA Hub (PWA).
 *
 * Ce qu'il fait :
 *  - l'interface s'ouvre vite et hors ligne : la coquille (page, icônes,
 *    motif) et les fichiers compilés par Vite (/assets/, noms hachés) sont
 *    mis en cache ; sans réseau, une page « hors ligne » remplace l'erreur
 *    du navigateur ;
 *  - les notifications push du hub s'affichent même l'application fermée, et
 *    un appui ouvre la bonne page.
 *
 * Ce qu'il ne fait jamais : mettre en cache les données. /api/, /campagnes/,
 * /media/ et la clé publique des jetons passent toujours par le réseau — une
 * donnée périmée, ou le fichier privé d'une personne resté sur un appareil
 * partagé, serait pire qu'une page qui ne charge pas.
 */
const VERSION = 'gdahub-v2';
// En développement (localhost), aucun cache : on voit toujours le code du moment.
const DEVELOPPEMENT = ['localhost', '127.0.0.1'].includes(self.location.hostname);
const COQUILLE = ['/', '/hors-ligne.html', '/manifest.webmanifest', '/motif-orange.jpg', '/icons/icon-192.png', '/icons/badge-96.png'];
const JAMAIS_EN_CACHE = ['/api/', '/campagnes/', '/media/', '/.well-known/', '/sante/'];

self.addEventListener('install', (event) => {
  // Pas de skipWaiting ici : une nouvelle version attend que la personne
  // clique « Mettre à jour » (message MISE_A_JOUR), au lieu de remplacer
  // l'interface en pleine saisie. À la toute première visite, il n'y a pas
  // d'ancienne version : celle-ci s'active d'elle-même.
  if (DEVELOPPEMENT) return;
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(COQUILLE)));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'MISE_A_JOUR') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (DEVELOPPEMENT || requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) {
    // Polices Google : servies depuis le cache une fois téléchargées.
    if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
      event.respondWith(depuisCacheSinonReseau(requete));
    }
    return;
  }
  if (JAMAIS_EN_CACHE.some((p) => url.pathname.startsWith(p))) return;

  // Navigation : le réseau d'abord (version à jour), la coquille ou la page
  // hors ligne sinon. Le HashRouter fait que toute page est « / ».
  if (requete.mode === 'navigate') {
    event.respondWith(
      fetch(requete)
        .then((reponse) => {
          if (reponse.ok && url.pathname === '/') {
            const copie = reponse.clone();
            caches.open(VERSION).then((cache) => cache.put('/', copie));
          }
          return reponse;
        })
        .catch(async () => (await caches.match('/')) || (await caches.match('/hors-ligne.html'))),
    );
    return;
  }

  // Fichiers compilés (noms hachés, immuables) et images de l'interface.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || /\.(png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(depuisCacheSinonReseau(requete));
  }
});

async function depuisCacheSinonReseau(requete) {
  const cache = await caches.open(VERSION);
  const connue = await cache.match(requete);
  if (connue) return connue;
  const reponse = await fetch(requete);
  if (reponse.ok || reponse.type === 'opaque') cache.put(requete, reponse.clone());
  return reponse;
}

// --- Notifications push ----------------------------------------------------

self.addEventListener('push', (event) => {
  let donnees = {};
  try {
    donnees = event.data ? event.data.json() : {};
  } catch {
    donnees = { titre: event.data ? event.data.text() : 'GDA Hub' };
  }
  const titre = donnees.titre || 'GDA Hub';
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(titre, {
        body: donnees.message || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: donnees.id ? `gdahub-${donnees.id}` : undefined,
        data: { lien: donnees.lien || '/' },
      }),
      // Les onglets ouverts rechargent leur cloche.
      self.clients.matchAll({ type: 'window' }).then((onglets) => onglets.forEach((o) => o.postMessage({ type: 'notification-recue' }))),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const lien = (event.notification.data && event.notification.data.lien) || '/';
  // Les pages de l'interface vivent derrière « # » (HashRouter).
  const cible = lien.startsWith('/') ? `/#${lien}` : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((onglets) => {
      const ouvert = onglets.find((o) => new URL(o.url).origin === self.location.origin);
      if (ouvert) {
        ouvert.focus();
        return ouvert.navigate ? ouvert.navigate(cible) : undefined;
      }
      return self.clients.openWindow(cible);
    }),
  );
});
