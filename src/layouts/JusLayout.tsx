import { ArrowLeft, Bell, Citrus, LogOut, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION } from '../lib/navigation';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Identité visuelle propre de Jus d'orange (fond clair, accent orange
 * "marque" #eb6834) — restaurée depuis frontend/src/jus/composants/app/ du
 * dépôt GdaHub. Voir retrogradeAppmetier.md : le hub ne s'étend plus dans
 * les apps métier, chacune garde son propre habillage.
 */
function estActif(chemin: string, href: string) {
  if (href === chemin) return true;
  const segments = href.split('/').filter(Boolean);
  if (segments.length <= 1) return false;
  return chemin.startsWith(`${href}/`);
}

const GROUPES = NAVIGATION.filter((g) => g.app === 'jus');

function initiales(nom: string) {
  return nom
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join('')
    .toUpperCase();
}

export default function JusLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';

  return (
    <div className="flex h-screen w-full bg-[#faf9f8] text-slate-900">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-jus-primary text-white">
            <Citrus size={18} />
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-slate-900">JusOrange</p>
            <p className="text-xs text-slate-500">Pilotage production</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {GROUPES.map((groupe) => (
            <div key={groupe.key}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {groupe.label.replace("Jus d'orange — ", '')}
              </p>
              <div className="space-y-0.5">
                {groupe.items.map((item) => {
                  const Icon = item.icon;
                  const actif = estActif(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        actif ? 'bg-jus-primary/10 text-jus-primaryDark' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-400">JusOrange · Campagne 2026</div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <Link
            to="/"
            title="Revenir à GDA Hub"
            className="hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 sm:inline-flex"
          >
            <ArrowLeft size={15} />
            GDA Hub
          </Link>

          <div className="relative ml-auto w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <button className="relative shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <Bell size={16} />
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-jus-primary text-[10px] font-bold text-white">
              3
            </span>
          </button>

          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOuvert((v) => !v)}
              className="flex size-9 items-center justify-center rounded-full bg-jus-primary/15 text-sm font-semibold text-jus-primaryDark"
            >
              {initiales(nomAffiche)}
            </button>
            {menuOuvert && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-medium text-slate-800">{nomAffiche}</p>
                  </div>
                  <button
                    onClick={() => {
                      deconnecter();
                      navigate('/connexion');
                    }}
                    className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut size={14} /> Déconnexion
                    </span>
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
