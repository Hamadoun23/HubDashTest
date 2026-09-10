import { Bell, Building2, ChevronRight, Home, LogOut, Search, Settings, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { APPLICATIONS_HUB, NAVIGATION, type AppKey } from '../lib/navigation';
import { useAuth } from '../lib/auth/AuthContext';
import { Avatar } from './ui/Avatar';

function estActif(chemin: string, href: string) {
  if (href === '/') return chemin === '/';
  return chemin === href || chemin.startsWith(`${href}/`);
}

function appDepuisChemin(chemin: string): AppKey {
  if (chemin.startsWith('/rh')) return 'rh';
  if (chemin.startsWith('/jus')) return 'jus';
  if (chemin.startsWith('/chantiers')) return 'chantiers';
  if (chemin.startsWith('/planning')) return 'planning';
  if (chemin.startsWith('/campagnes')) return 'campagnes';
  return 'hub';
}

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { identite, utilisateur, applications, deconnecter } = useAuth();
  const [lightMode, setLightMode] = useState(false);

  const appActive = appDepuisChemin(pathname);
  // Chaque utilisateur ne voit que les applications auxquelles il a accès
  // (`applications`, renvoyées par identity à la connexion) — même filtre que
  // l'ancien lanceur en tuiles de l'accueil, appliqué ici à la sidebar.
  const applicationsAccessibles = APPLICATIONS_HUB.filter((app) =>
    applications.some((a) => a.active && a.chemin.split('/')[1] === app.chemin.split('/')[1]),
  );

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-surface backdrop-blur-xl">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow">
          <img src="/logo-gda.png" alt="GD&A" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-lg font-bold tracking-tight text-white">GDA Hub</p>
          <p className="truncate text-xs text-muted">Espace connecté</p>
        </div>
      </div>

      <div className="mx-4 flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
        <Search size={16} className="text-muted" />
        <input
          placeholder="Rechercher..."
          className="w-full bg-transparent text-sm text-white placeholder:text-muted focus:outline-none"
        />
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Accueil</p>
          </div>
          <Link
            to="/"
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              estActif(pathname, '/') ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
            }`}
          >
            <Home size={16} className="shrink-0" />
            Mes applications
          </Link>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Board</p>
          </div>
          <Link
            to="/administration"
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              estActif(pathname, '/administration') ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
            }`}
          >
            <Building2 size={16} className="shrink-0" />
            Administration
          </Link>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent2" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Applications</p>
          </div>
          <div className="space-y-0.5">
            {applicationsAccessibles.map((app) => {
              const Icone = app.icon;
              const active = appActive === app.key;
              return (
                <div key={app.key}>
                  <Link
                    to={app.chemin}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
                    }`}
                  >
                    <Icone size={16} className="shrink-0" />
                    <span className="truncate">{app.nom}</span>
                  </Link>

                  {active && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                      {NAVIGATION.filter((g) => g.app === app.key).flatMap((groupe) => groupe.items).map((item) => {
                        const ItemIcone = item.icon;
                        const itemActif = estActif(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              itemActif ? 'bg-accent/20 text-accent2' : 'text-muted hover:bg-surface2 hover:text-white'
                            }`}
                          >
                            <ItemIcone size={13} className="shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
        <button className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface2 hover:text-white">
          <span className="flex items-center gap-3">
            <Bell size={17} />
            Notifications
          </span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
            3
          </span>
        </button>
        <Link
          to="/mon-compte"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-white"
        >
          <Settings size={17} />
          Paramètres
        </Link>
      </div>

      <div className="border-t border-border p-3">
        <button
          onClick={() => setLightMode((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface2 px-3 py-2.5"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-white">
            <Sun size={16} className="text-accent2" />
            Mode clair
          </span>
          <span
            className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
              lightMode ? 'bg-accent' : 'bg-surface'
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                lightMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </span>
        </button>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
          <Link to="/mon-compte" className="flex flex-1 items-center gap-3 overflow-hidden">
            <Avatar label={identite?.nom_complet ?? '?'} size={36} />
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-sm font-semibold text-white">{identite?.nom_complet ?? 'Non connecté'}</p>
              <p className="truncate text-xs text-muted">{utilisateur?.poste || identite?.fonction || ''}</p>
            </div>
          </Link>
          <Link to="/mon-compte" className="shrink-0 text-muted hover:text-white">
            <ChevronRight size={16} />
          </Link>
          <button
            onClick={() => {
              deconnecter();
              navigate('/connexion');
            }}
            title="Se déconnecter"
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-white"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
