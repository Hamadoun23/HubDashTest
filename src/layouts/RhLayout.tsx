import { useCallback, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { BoutonMenu, TiroirMobile } from '../components/TiroirMobile';
import { ClocheNotifications } from '../components/notifications/ClocheNotifications';
import { useAuth } from '../lib/auth/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { BoutonRetourHub, NavigationApps } from '../components/NavigationApps';

/**
 * RH & Finance reprend maintenant l'habillage sombre "Virtus" du hub —
 * demande explicite du 14/09/2026, qui remplace la charte claire propre
 * (logo GD&A, orange #ff6a3a/#d03e0d) restaurée le 11/09/2026. Toutes les
 * autres apps métier gardent pour l'instant leur identité propre : cette
 * bascule se fait app par app.
 */
export default function RhLayout() {
  const [menuMobile, setMenuMobile] = useState(false);
  const fermerMenu = useCallback(() => setMenuMobile(false), []);
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';

  // Même barre latérale sur grand écran et dans le tiroir mobile.
  const barreLaterale = (
      <aside className="hidden h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-surface backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Link to="/rh" className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow">
              <img src="/logo-gda.png" alt="GD&amp;A" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-lg font-bold tracking-tight text-white">GDA Hub</p>
              <p className="truncate text-xs text-muted">RH &amp; Finance</p>
            </div>
          </Link>
        </div>
  
        <div className="px-3 pb-3">
          <BoutonRetourHub />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavigationApps onNaviguer={fermerMenu} />
        </nav>
  
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
            <Link to="/rh/mon-espace" className="flex flex-1 items-center gap-3 overflow-hidden">
              <Avatar label={nomAffiche} size={36} />
              <div className="flex-1 overflow-hidden text-left">
                <p className="truncate text-sm font-semibold text-white">{nomAffiche}</p>
                <p className="truncate text-xs text-muted">{utilisateur?.poste}</p>
              </div>
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
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-4 backdrop-blur-md sm:justify-end sm:px-8">
          <BoutonMenu onClick={() => setMenuMobile(true)} className="lg:hidden" />
          <Link to="/rh" className="shrink-0 font-display text-base font-bold text-white lg:hidden">
            GDA Hub
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex lg:hidden">
              <BoutonRetourHub compact />
            </span>

            <ClocheNotifications />

            <div className="relative">
              <button
                onClick={() => setMenuOuvert((v) => !v)}
                className="flex items-center gap-2.5 rounded-full border border-border bg-surface2 py-1.5 pl-1.5 pr-3 backdrop-blur-sm transition hover:bg-surface"
              >
                <Avatar label={nomAffiche} size={28} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium text-white">{nomAffiche}</span>
                  <span className="block text-[11px] text-muted">{utilisateur?.poste}</span>
                </span>
              </button>

              {menuOuvert && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg backdrop-blur-xl">
                    <Link
                      to="/rh/mon-espace"
                      onClick={() => setMenuOuvert(false)}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted hover:bg-surface2 hover:text-white"
                    >
                      <Settings size={14} />
                      Mon profil
                    </Link>
                    <button
                      onClick={() => {
                        deconnecter();
                        navigate('/connexion');
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10"
                    >
                      <LogOut size={14} />
                      Se déconnecter
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
