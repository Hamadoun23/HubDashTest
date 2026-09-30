import { Menu, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Tiroir de navigation pour les petits écrans.
 *
 * Les barres latérales du hub et des applications sont masquées sous `lg`
 * (ou `md`) : sans ce tiroir, un téléphone n'avait aucun moyen de passer
 * d'une section à l'autre. Il reçoit la barre latérale elle-même (le même
 * élément que sur grand écran, forcé visible ici), se ferme à chaque
 * navigation, sur Échap ou en touchant le fond.
 */
export function TiroirMobile({ ouvert, onFermer, children }: { ouvert: boolean; onFermer: () => void; children: ReactNode }) {
  const { pathname } = useLocation();

  // Toute navigation referme le tiroir.
  useEffect(() => {
    onFermer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', surTouche);
    // Le contenu derrière ne défile pas pendant que le tiroir est ouvert.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = avant;
    };
  }, [ouvert, onFermer]);

  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${ouvert ? '' : 'pointer-events-none'}`} aria-hidden={!ouvert}>
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${ouvert ? 'opacity-100' : 'opacity-0'}`}
        onClick={onFermer}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute inset-y-0 left-0 flex max-w-[86vw] bg-[#1a130e]/95 shadow-2xl transition-transform duration-200 [&>aside]:!flex [&>aside]:max-w-full ${
          ouvert ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le menu"
          className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-surface2 hover:text-white"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

/** Bouton « menu » de l'en-tête, visible seulement sur petit écran. */
export function BoutonMenu({ onClick, className = 'lg:hidden' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ouvrir le menu"
      className={`shrink-0 rounded-xl border border-border bg-surface2 p-2 text-muted transition hover:text-white ${className}`}
    >
      <Menu size={18} />
    </button>
  );
}
