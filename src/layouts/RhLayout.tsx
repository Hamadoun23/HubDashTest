import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION } from '../lib/navigation';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Identité visuelle propre de FinanceRH — logo GD&A, orange de marque
 * #ff6a3a/#d03e0d, gris ardoise — restaurée depuis
 * frontend/src/rh/composants/navigation.tsx du dépôt GdaHub.
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

const GROUPE = NAVIGATION.find((g) => g.app === 'rh')!;

export default function RhLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';

  return (
    <div className="flex h-screen w-full bg-[#f7f7f8] text-[#2c2d2e]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-4 py-4">
          <Link to="/rh" className="block">
            <span className="text-lg font-bold tracking-tight text-[#2c2d2e]">GD&amp;A</span>
            <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              RH &amp; Finance
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {GROUPE.items.map((item) => {
            const Icon = item.icon;
            const actif = estActif(pathname, item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2.5 rounded-lg border-l-[3px] px-2.5 py-2.5 text-sm transition ${
                  actif
                    ? 'border-rh-marque500 bg-rh-marque50 font-semibold text-rh-marque800'
                    : 'border-transparent text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <Link to="/rh" className="shrink-0 text-base font-bold text-[#2c2d2e] lg:hidden">
            GD&amp;A
          </Link>

          <Link
            to="/"
            title="Revenir à GDA Hub"
            className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 sm:inline-flex"
          >
            <span aria-hidden>&larr;</span>
            GDA Hub
          </Link>

          <div className="relative ml-auto sm:ml-0">
            <button
              onClick={() => setMenuOuvert((v) => !v)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-rh-marque100 text-xs font-semibold text-rh-marque700">
                {initiales(nomAffiche)}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium text-slate-800">{nomAffiche}</span>
                <span className="block text-[11px] text-slate-500">{utilisateur?.poste}</span>
              </span>
            </button>

            {menuOuvert && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <Link
                    to="/rh/mon-espace"
                    onClick={() => setMenuOuvert(false)}
                    className="block rounded-md px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    Mon profil
                  </Link>
                  <button
                    onClick={() => {
                      deconnecter();
                      navigate('/connexion');
                    }}
                    className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
