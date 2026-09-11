import { Clapperboard, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION } from '../lib/navigation';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Identité visuelle propre de Planning : dégradé orange en entête et barre
 * horizontale à onglets, reprise de frontend/src/planning/composants/
 * navigation.tsx du dépôt GdaHub (source : DocsERP/Planning-main, Laravel).
 * Voir retrogradeAppmetier.md.
 */
function estActif(chemin: string, href: string) {
  return chemin === href || chemin.startsWith(`${href}/`);
}

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join('')
    .toUpperCase();
}

const ONGLETS = NAVIGATION.find((g) => g.app === 'planning')!.items;

export default function PlanningLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';

  return (
    <div className="min-h-screen bg-[#fbf7f4] text-slate-900">
      <header
        className="sticky top-0 z-40 shadow-[0_2px_16px_rgba(0,0,0,0.12)]"
        style={{ background: 'linear-gradient(135deg, #ff8a5c 0%, #ff6a3a 45%, #e8481b 100%)' }}
      >
        <div className="flex h-16 items-center gap-3 px-4 md:px-8">
          <Link to="/planning" className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-white">
              <Clapperboard size={18} />
            </span>
            <span className="hidden leading-tight text-white sm:block">
              <span className="block text-sm font-bold">GDA Media Planning</span>
              <span className="block text-[11px] font-medium text-white/80">Gestion des plannings</span>
            </span>
          </Link>

          <div className="flex-1" />

          <Link
            to="/"
            title="Revenir à GDA Hub"
            className="hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/75 transition hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <span aria-hidden>&larr;</span>
            GDA Hub
          </Link>

          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOuvert((v) => !v)}
              className="flex items-center gap-2.5 rounded-full border border-white/25 bg-white/10 py-1 pl-1 pr-3.5 transition hover:border-white/35 hover:bg-white/20"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-white text-xs font-bold text-planning-o3">
                {initiales(nomAffiche)}
              </span>
              <span className="hidden text-sm font-medium text-white sm:block">{nomAffiche}</span>
            </button>

            {menuOuvert && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                <div className="absolute right-0 z-20 mt-2 min-w-[200px] rounded-[10px] border border-slate-200 bg-white p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                  <button
                    onClick={() => {
                      deconnecter();
                      navigate('/connexion');
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-planning-o3 hover:bg-orange-50"
                  >
                    <LogOut size={14} /> Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-white/15 px-2 pb-0 md:px-6">
          {ONGLETS.map((onglet) => {
            const Icon = onglet.icon;
            const actif = estActif(pathname, onglet.href);
            return (
              <Link
                key={onglet.href}
                to={onglet.href}
                className={`flex items-center gap-2 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition md:py-3 ${
                  actif ? 'bg-[#fbf7f4] text-planning-o3' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                {onglet.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
