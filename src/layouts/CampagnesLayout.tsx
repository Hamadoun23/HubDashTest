import { ArrowLeft, Bell, Clapperboard, LogOut, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION } from '../lib/navigation';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Identité visuelle réelle de Campagnes (alias "BDM" / "GDA Money"), reprise
 * du dépôt de production `Hamadoun23/Bdm` (frontend/src/Layouts/AppLayout.jsx
 * + Components/Sidebar.jsx) — pas de la copie retrouvée dans
 * backend/campagnes-frontend/ de ce dépôt, qui s'est avérée être une version
 * déjà "uniformisée" vers la charte sombre du hub (sidebar large ardoise-950),
 * à l'opposé de ce que Campagnes affiche réellement en prod : un rail
 * d'icônes étroit (76px), clair, sur un canevas crème #F6F5F2. Voir
 * retrogradeAppmetier.md.
 */
function estActif(chemin: string, href: string) {
  return chemin === href || chemin.startsWith(`${href}/`);
}

const GROUPE = NAVIGATION.find((g) => g.app === 'campagnes')!;

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join('')
    .toUpperCase();
}

export default function CampagnesLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';

  return (
    <div className="flex h-screen w-full bg-[#F6F5F2] text-gray-900">
      {/* Rail d'icônes — 76px, toujours clair : c'est le canevas qui reste
          crème, pas la sidebar qui passe sombre (à l'inverse des autres apps
          métier). Fidèle au rail réel de Bdm/frontend/src/Components/Sidebar.jsx. */}
      <aside className="hidden w-[76px] shrink-0 flex-col items-center border-r border-gray-200 bg-white py-5 md:flex">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-campagnes-primary/10 text-campagnes-primary">
          <Clapperboard size={20} />
        </span>

        <nav className="mt-6 flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
          {GROUPE.items.map((item) => {
            const Icon = item.icon;
            const actif = estActif(pathname, item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                  actif ? 'bg-campagnes-primary/10 text-campagnes-primary' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                {actif && <span className="absolute left-0 h-5 w-1 rounded-r-full bg-campagnes-primary" />}
                <Icon size={19} strokeWidth={2} />
                <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => {
            deconnecter();
            navigate('/connexion');
          }}
          title="Déconnexion"
          className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <LogOut size={19} />
        </button>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-campagnes-primary text-xs font-semibold text-white">
          {initiales(nomAffiche)}
        </span>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 px-4 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-500">Campagnes GDA</p>
          </div>

          <Link
            to="/"
            title="Revenir à GDA Hub"
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-gray-500 shadow-sm ring-1 ring-gray-200 transition hover:text-gray-900 sm:inline-flex"
          >
            <ArrowLeft size={15} />
            GDA Hub
          </Link>

          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
              <Search size={15} />
              <span className="hidden lg:inline">Rechercher…</span>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm ring-1 ring-gray-200 hover:text-gray-600">
              <Bell size={16} />
            </button>
          </div>

          <div className="relative shrink-0 md:hidden">
            <button
              onClick={() => setMenuOuvert((v) => !v)}
              className="flex size-9 items-center justify-center rounded-full bg-campagnes-primary/15 text-sm font-semibold text-campagnes-primaryDark"
            >
              {initiales(nomAffiche)}
            </button>
            {menuOuvert && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-medium text-gray-800">{nomAffiche}</p>
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

        <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 pb-10 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
