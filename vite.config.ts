import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Sans la passerelle nginx (Docker), les 6 services Django tournent chacun
// sur son propre port via `manage.py runserver` — voir contexte.md. Ce proxy
// reproduit le routage de gateway/nginx.conf : même préfixes, même reécriture
// de chemin (jus/chantiers/planning retirent leur préfixe, identity/rh/finance
// le gardent, campagnes le retire entièrement).
const PORTS = {
  // 8001 est pris par Kong (Docker, autre projet local) sur cette machine —
  // identity tourne sur 8011 à la place.
  identity: 8011,
  financerh: 8002,
  jusorange: 8003,
  chantiers: 8004,
  planning: 8005,
  campagnes: 8006,
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Les pages de Campagnes (src/campagnes/, reprises de BDM) importent leurs
    // composants via « @/ » — ici « @campagnes/ » — et Inertia via
    // « @inertiajs/react », remplacé par le pont qui les sert dans le hub.
    alias: {
      '@campagnes': fileURLToPath(new URL('./src/campagnes', import.meta.url)),
      '@inertiajs/react': fileURLToPath(new URL('./src/campagnes/inertia/index.jsx', import.meta.url)),
    },
  },
  server: {
    // Servi derrière la passerelle nginx de GDA Hub en Docker : le Host vu
    // par Vite n'est alors pas localhost. Sans Docker, ces options sont
    // inertes (host: true équivaut au comportement par défaut en local).
    host: true,
    allowedHosts: true,
    watch: {
      // Le dépôt héberge aussi les 6 services Django (backend/) et leurs
      // dépendances (gateway/, libs/, infra/) : les exclure évite à Vite de
      // surveiller des milliers de fichiers Python sans rapport avec ce
      // frontend, qui ralentiraient le rechargement à chaque `pip install`.
      ignored: ['**/backend/**', '**/gateway/**', '**/libs/**', '**/infra/**'],
      // Sous Docker Desktop sur Windows, les evenements natifs du systeme de
      // fichiers (inotify) ne remontent pas de l'hote vers le conteneur pour
      // un volume monte : sans le polling, Vite ne voit tout simplement
      // jamais les fichiers modifies et le HMR reste silencieusement mort.
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api/identity': { target: `http://localhost:${PORTS.identity}` },
      '/api/rh': { target: `http://localhost:${PORTS.financerh}` },
      '/api/finance': { target: `http://localhost:${PORTS.financerh}` },
      '/api/auth': { target: `http://localhost:${PORTS.financerh}` },
      '/api/jus': { target: `http://localhost:${PORTS.jusorange}`, rewrite: (p) => p.replace(/^\/api\/jus/, '/api') },
      '/api/chantiers': { target: `http://localhost:${PORTS.chantiers}`, rewrite: (p) => p.replace(/^\/api\/chantiers/, '/api') },
      '/api/planning': { target: `http://localhost:${PORTS.planning}`, rewrite: (p) => p.replace(/^\/api\/planning/, '/api') },
      '/campagnes': { target: `http://localhost:${PORTS.campagnes}`, rewrite: (p) => p.replace(/^\/campagnes/, ''), changeOrigin: true },
      '/.well-known/jwks.json': { target: `http://localhost:${PORTS.identity}` },
    },
  },
  preview: {
    host: true,
    allowedHosts: true,
    // `vite preview` sert l'interface compilée en production (Dockerfile,
    // cible « production ») : ces en-têtes ne s'appliquent qu'à elle, pas au
    // serveur de développement (HMR, scripts injectés par Vite).
    //
    // La CSP n'autorise que l'origine du hub et Google Fonts : un script
    // injecté par une faille XSS ne pourrait ni se charger d'ailleurs, ni
    // envoyer ce qu'il a lu (jetons compris) vers un autre site.
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; '),
    },
  },
});
