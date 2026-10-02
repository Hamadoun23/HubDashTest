import { Bell, Building2, ChevronRight, Home, LogOut, Settings } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { Avatar } from './ui/Avatar';
import { BoutonInstaller } from './BoutonInstaller';
import { NavigationApps } from './NavigationApps';
import { useNotificationsOptionnelles } from '../lib/notifications/NotificationsContext';

function estActif(chemin: string, href: string) {
  if (href === '/') return chemin === '/';
  return chemin === href || chemin.startsWith(`${href}/`);
}

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { identite, utilisateur, habilitations, deconnecter } = useAuth();
  const nonLues = useNotificationsOptionnelles()?.nonLues ?? 0;
  // L'administration du hub n'est proposée qu'à ceux qui peuvent s'en servir.
  const estAdminHub = Boolean(identite?.est_superadmin || habilitations.hub);

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

        {estAdminHub && (
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
        )}

        <NavigationApps />
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
        <BoutonInstaller />
        <Link
          to="/notifications"
          className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            estActif(pathname, '/notifications') ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-3">
            <Bell size={17} />
            Notifications
          </span>
          {nonLues > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-black">
              {nonLues > 99 ? '99+' : nonLues}
            </span>
          )}
        </Link>
        <Link
          to="/mon-compte"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-white"
        >
          <Settings size={17} />
          Paramètres
        </Link>
      </div>

      <div className="border-t border-border p-3">

        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
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
