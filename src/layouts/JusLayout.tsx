import { Citrus, LogOut, Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { BoutonRetourHub, NavigationApps } from '../components/NavigationApps';
import { BoutonMenu, TiroirMobile } from '../components/TiroirMobile';
import { ClocheNotifications } from '../components/notifications/ClocheNotifications';
import { useAuth } from '../lib/auth/AuthContext';
import { Avatar } from '../components/ui/Avatar';

/**
 * Jus d'orange reprend l'habillage sombre "Virtus" du hub, au même titre
 * que RH & Finance (voir RhLayout.tsx) — demande explicite : même motif,
 * mêmes surfaces translucides plutôt que l'identité claire propre restaurée
 * précédemment. Chantiers et Planning gardent pour l'instant la leur.
 */
export default function JusLayout() {
  const [menuMobile, setMenuMobile] = useState(false);
  const fermerMenu = useCallback(() => setMenuMobile(false), []);
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';



  // Même barre latérale sur grand écran et dans le tiroir mobile.
  const barreLaterale = (
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
  
        <div className="px-3 pb-3 pt-4">
          <BoutonRetourHub />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavigationApps onNaviguer={fermerMenu} />
        </nav>
  
        <div className="border-t border-border p-4 text-xs text-muted">JusOrange · Campagne 2026</div>
      </aside>
  );

  return (
    <div
      className="flex h-screen w-full bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/motif-orange.jpg')" }}
    >
      {barreLaterale}
      <TiroirMobile ouvert={menuMobile} onFermer={fermerMenu}>
        {barreLaterale}
      </TiroirMobile>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/40 px-4 backdrop-blur-md">
          <BoutonMenu onClick={() => setMenuMobile(true)} className="md:hidden" />
          <span className="hidden sm:inline-flex md:hidden">
            <BoutonRetourHub compact />
          </span>

          <div className="relative ml-auto w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-border bg-surface2 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          <ClocheNotifications />

          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOuvert((v) => !v)}
              className="flex items-center gap-2.5 rounded-full border border-border bg-surface2 py-1.5 pl-1.5 pr-3 backdrop-blur-sm transition hover:bg-surface"
            >
              <Avatar label={nomAffiche} size={28} moi />
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
