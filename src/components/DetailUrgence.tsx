import { ArrowUpRight, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NOM_APP, type Urgence } from '../lib/urgences';

/**
 * Détail d'une urgence de l'accueil : de quoi il s'agit, les éléments
 * concernés (articles, dossiers, publications…) et le bouton pour la traiter.
 */
export function DetailUrgence({ urgence, onFermer }: { urgence: Urgence | null; onFermer: () => void }) {
  useEffect(() => {
    if (!urgence) return;
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [urgence, onFermer]);

  if (!urgence) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={urgence.titre}>
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60" onClick={onFermer} />
      <div
        className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 backdrop-blur-xl sm:max-w-lg sm:rounded-3xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent2">
              {NOM_APP[urgence.app]}
              {urgence.gravite === 'haute' && <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-red-300">Priorité haute</span>}
            </p>
            <h2 className="mt-1 font-display text-lg font-bold text-white">{urgence.titre}</h2>
          </div>
          <button type="button" onClick={onFermer} className="rounded-full p-2 text-muted hover:text-white" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-white/85">{urgence.explication}</p>

        {urgence.elements && urgence.elements.length > 0 && (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface2">
            {urgence.elements.map((e, i) => (
              <li key={`${e.libelle}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-white">{e.libelle}</span>
                <span className="shrink-0 text-xs font-semibold text-muted">{e.valeur}</span>
              </li>
            ))}
          </ul>
        )}

        <Link
          to={urgence.lien}
          onClick={onFermer}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:bg-accent2"
        >
          {urgence.action}
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
