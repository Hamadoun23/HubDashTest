import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Sans la passerelle nginx (Docker), les 6 services Django tournent chacun
// sur son propre port via `manage.py runserver` — voir contexte.md. Ce proxy
// reproduit le routage de gateway/nginx.conf : même préfixes, même reécriture
// de chemin (jus/chantiers/planning retirent leur préfixe, identity/rh/finance
// le gardent, campagnes le retire entièrement).
const PORTS = {
  identity: 8001,
  financerh: 8002,
  jusorange: 8003,
  chantiers: 8004,
  planning: 8005,
  campagnes: 8006,
};

export default defineConfig({
  plugins: [react()],
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
  },
});
