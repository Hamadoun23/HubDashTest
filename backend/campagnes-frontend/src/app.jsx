import './css/app.css';
import './bootstrap';
import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { route } from 'ziggy-js';

const appName = import.meta.env.VITE_APP_NAME || 'Campagne BDM';

// Rend route() disponible globalement dans les composants React. window.Ziggy
// n'est plus injecté par la directive Blade @routes mais construit par Django à
// partir de son URLconf (cf. backend/core/routes.py) — l'objet a la même forme,
// donc les appels route() des pages restent inchangés.
window.route = (name, params, absolute) => route(name, params, absolute, window.Ziggy);

// Remplace resolvePageComponent de laravel-vite-plugin, qui n'a plus lieu
// d'être sans Laravel. Même contrat : résolution paresseuse d'un composant de
// ./Pages à partir de son nom Inertia (ex. « Admin/Campagnes/Index »).
const pages = import.meta.glob('./Pages/**/*.jsx');

createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),
    resolve: (name) => {
        const chemin = `./Pages/${name}.jsx`;
        const page = pages[chemin];
        if (!page) {
            throw new Error(`Page Inertia introuvable : ${chemin}`);
        }
        return page();
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        color: '#FF6A3A',
    },
});
