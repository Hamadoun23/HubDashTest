/** Adresse du service `campagnes` (alias interne « bdm ») derrière la passerelle.
 *
 * Campagnes n'est pas une API DRF comme les autres services du hub : c'est
 * l'application BDM (Django + Inertia), dont les écrans React sont repris
 * tels quels dans `src/campagnes/` et lus en JSON par le pont Inertia
 * (`src/campagnes/inertia/`). Ce module ne porte plus que l'adresse de base ;
 * le transport (session, CSRF, jeton du hub) est dans `inertia/noyau.js`. */
export const BASE = (import.meta.env.VITE_CAMPAGNES_BASE_URL as string | undefined) ?? '/campagnes';
