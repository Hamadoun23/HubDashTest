import { HardHat, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Identité visuelle propre de Chantiers, reprise de daily.gdamali.net
 * (Laravel, DocsERP/dailygda/public/css/gda.css) via le dépôt GdaHub :
 * entête sombre, palette crème #f4f1eb, terracotta #c8521a, titre marron
 * #381419. Voir retrogradeAppmetier.md.
 */
function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join('')
    .toUpperCase();
}

export default function ChantiersLayout() {
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';

  return (
    <div className="min-h-screen bg-chantiers-creme text-chantiers-marron">
      <header
        className="sticky top-0 z-40 flex h-20 items-center gap-4 px-4 shadow-[0_2px_16px_rgba(0,0,0,0.2)] md:px-8"
        style={{ background: 'linear-gradient(90deg, #1a1814 0%, #241f18 60%, #1a1814 100%)' }}
      >
        <Link to="/chantiers" className="flex shrink-0 items-center gap-2.5 text-white">
          <span className="flex size-9 items-center justify-center rounded-xl bg-chantiers-terracotta text-white">
            <HardHat size={18} />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-bold">GD&amp;A Construction</span>
            <span className="block text-[11px] font-medium text-white/70">Suivi de chantiers</span>
          </span>
        </Link>

        <div className="flex-1" />

        <Link
          to="/"
          title="Revenir à GDA Hub"
          className="hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/55 transition hover:bg-white/10 hover:text-white sm:inline-flex"
        >
          <span aria-hidden>&larr;</span>
          GDA Hub
        </Link>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOuvert((v) => !v)}
            className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 py-1 pl-1 pr-3.5 transition hover:border-white/30 hover:bg-white/20"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-chantiers-terracotta text-xs font-bold text-white">
              {initiales(nomAffiche)}
            </span>
            <span className="hidden text-sm font-medium text-white sm:block">{nomAffiche}</span>
          </button>

          {menuOuvert && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
              <div className="absolute right-0 z-20 mt-2 min-w-[200px] rounded-[10px] border border-chantiers-creme bg-white p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                <button
                  onClick={() => {
                    deconnecter();
                    navigate('/connexion');
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-chantiers-terracotta hover:bg-[#f9ece4]"
                >
                  <LogOut size={14} /> Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
