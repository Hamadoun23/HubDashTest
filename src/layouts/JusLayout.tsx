import { Bell, Citrus, LogOut, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION } from '../lib/navigation';
import { useAuth } from '../lib/auth/AuthContext';
import { useApi } from '../lib/hooks/useApi';
import { monProfilJus } from '../lib/api/jus';
import { Avatar } from '../components/ui/Avatar';

/**
 * Jus d'orange reprend l'habillage sombre "Virtus" du hub, au même titre
 * que RH & Finance (voir RhLayout.tsx) — demande explicite : même motif,
 * mêmes surfaces translucides plutôt que l'identité claire propre restaurée
 * précédemment. Chantiers et Planning gardent pour l'instant la leur.
 */
function estActif(chemin: string, href: string) {
  if (href === chemin) return true;
  const segments = href.split('/').filter(Boolean);
  if (segments.length <= 1) return false;
  return chemin.startsWith(`${href}/`);
}

const GROUPES = NAVIGATION.filter((g) => g.app === 'jus');

// Miroir de `api/permissions.py` côté jusorange : qui a le droit d'écrire ou
// de lire chaque domaine (`rw(read=…, write=…)`). Finance lit Production et
// Commercial (pas seulement Finance/Reporting) ; Direction lit tout. Sans ce
// filtre, tout le monde voyait les cinq sections quel que soit son groupe
// réel — jamais remarqué car on ne testait qu'avec un compte superuser (qui
// reçoit aussi les quatre rôles, voir `_user_payload`).
const ROLES_PAR_SECTION: Record<string, string[]> = {
  'orange-direction': ['Direction', 'Finance'],
  'orange-production': ['ResProd', 'Finance', 'Direction'],
  'orange-commercial': ['Commercial', 'Finance', 'Direction'],
  'orange-finance': ['Finance', 'Direction'],
  'orange-reporting': ['ResProd', 'Commercial', 'Finance', 'Direction'],
};

// Exceptions plus étroites que le reste de leur section — miroir exact de
// `IsDirection` (Utilisateurs) et de `ROLES_RAPPORT` (chaque rapport n'est
// pas ouvert à tous ceux qui voient l'onglet Reporting : Distribution est
// fermé à la production, les 5 autres sont fermés au commercial).
const ROLES_PAR_HREF: Record<string, string[]> = {
  '/jus/direction/utilisateurs': ['Direction'],
  '/jus/reporting/recolte': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/appro': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/fabrication': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/emballage': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/entrepot': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/distribution': ['Commercial', 'Finance', 'Direction'],
};

function itemVisible(sectionKey: string, href: string, roles: string[]) {
  const requis = ROLES_PAR_HREF[href] ?? ROLES_PAR_SECTION[sectionKey];
  if (!requis) return true;
  return requis.some((role) => roles.includes(role));
}

export default function JusLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const profil = useApi(monProfilJus, []);
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';
  const roles = profil.donnees?.roles ?? [];
  const groupesVisibles = GROUPES.map((groupe) => ({
    ...groupe,
    items: groupe.items.filter((item) => itemVisible(groupe.key, item.href, roles)),
  })).filter((groupe) => groupe.items.length > 0);


  return (
    <div
      className="flex h-screen w-full bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/motif-orange.jpg')" }}
    >
      <aside className="hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-surface backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-black">
            <Citrus size={18} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold text-white">JusOrange</p>
            <p className="truncate text-xs text-muted">Pilotage production</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groupesVisibles.map((groupe) => (
            <div key={groupe.key}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
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
                        actif ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
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

        <div className="border-t border-border p-4 text-xs text-muted">JusOrange · Campagne 2026</div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/40 px-4 backdrop-blur-md">
          <Link
            to="/"
            title="Revenir à GDA Hub"
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 text-xs font-semibold text-muted backdrop-blur-sm transition hover:text-white sm:inline-flex"
          >
            <span aria-hidden>&larr;</span>
            GDA Hub
          </Link>

          <div className="relative ml-auto w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-border bg-surface2 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          <button className="relative shrink-0 rounded-lg border border-border bg-surface2 p-2 text-muted hover:text-white">
            <Bell size={16} />
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-black">
              3
            </span>
          </button>

          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOuvert((v) => !v)}
              className="flex items-center gap-2.5 rounded-full border border-border bg-surface2 py-1.5 pl-1.5 pr-3 backdrop-blur-sm transition hover:bg-surface"
            >
              <Avatar label={nomAffiche} size={28} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium text-white">{nomAffiche}</span>
              </span>
            </button>
            {menuOuvert && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg backdrop-blur-xl">
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-medium text-white">{nomAffiche}</p>
                  </div>
                  <button
                    onClick={() => {
                      deconnecter();
                      navigate('/connexion');
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <LogOut size={14} />
                    Déconnexion
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
