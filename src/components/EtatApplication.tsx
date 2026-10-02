import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const UNE_HEURE = 60 * 60 * 1000;

/**
 * Vie de l'application installée, montée une seule fois :
 * - enregistre le service worker et vérifie les mises à jour chaque heure ;
 * - « Nouvelle version — Mettre à jour » quand une version attend : la page
 *   ne se recharge QUE sur ce clic (jamais d'elle-même, ce qui couperait une
 *   saisie en cours ou la première visite) ;
 * - « Hors connexion » / « Connexion rétablie ».
 */
export function EtatApplication() {
  const [enAttente, setEnAttente] = useState<ServiceWorker | null>(null);
  const [enLigne, setEnLigne] = useState(() => navigator.onLine);
  const [retour, setRetour] = useState(false);
  const miseAJourDemandee = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let minuterie: number | undefined;

    const surveiller = (reg: ServiceWorkerRegistration) => {
      // Une version attend déjà (onglet rouvert après un déploiement).
      if (reg.waiting && navigator.serviceWorker.controller) setEnAttente(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nouveau = reg.installing;
        nouveau?.addEventListener('statechange', () => {
          // « installed » avec un contrôleur existant = mise à jour, pas première visite.
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) setEnAttente(nouveau);
        });
      });
      minuterie = window.setInterval(() => reg.update().catch(() => undefined), UNE_HEURE);
    };

    const enregistrer = () =>
      navigator.serviceWorker
        .register('/sw.js')
        .then(surveiller)
        .catch(() => undefined);
    if (document.readyState === 'complete') enregistrer();
    else window.addEventListener('load', enregistrer, { once: true });

    const surChangement = () => {
      if (miseAJourDemandee.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', surChangement);
    return () => {
      window.clearInterval(minuterie);
      navigator.serviceWorker.removeEventListener('controllerchange', surChangement);
    };
  }, []);

  useEffect(() => {
    let delai: number | undefined;
    const horsLigne = () => {
      setEnLigne(false);
      setRetour(false);
    };
    const reconnecte = () => {
      setEnLigne(true);
      setRetour(true);
      window.clearTimeout(delai);
      delai = window.setTimeout(() => setRetour(false), 3000);
    };
    window.addEventListener('offline', horsLigne);
    window.addEventListener('online', reconnecte);
    return () => {
      window.removeEventListener('offline', horsLigne);
      window.removeEventListener('online', reconnecte);
      window.clearTimeout(delai);
    };
  }, []);

  const mettreAJour = () => {
    miseAJourDemandee.current = true;
    if (enAttente) enAttente.postMessage({ type: 'MISE_A_JOUR' });
    else window.location.reload();
  };

  const bandeau = 'pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-border bg-surface/95 px-4 py-2.5 text-sm text-white shadow-2xl backdrop-blur-xl';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      aria-live="polite"
    >
      {!enLigne && (
        <div className={bandeau}>
          <WifiOff size={16} className="text-amber-300" />
          Hors connexion — les données affichées peuvent dater.
        </div>
      )}
      {enLigne && retour && (
        <div className={bandeau}>
          <Wifi size={16} className="text-emerald-300" />
          Connexion rétablie
        </div>
      )}
      {enAttente && (
        <div className={bandeau}>
          <RefreshCw size={16} className="text-accent2" />
          Nouvelle version de GDA Hub
          <button type="button" onClick={mettreAJour} className="ml-1 rounded-lg bg-accent px-3 py-1 text-xs font-bold text-black">
            Mettre à jour
          </button>
        </div>
      )}
    </div>
  );
}
