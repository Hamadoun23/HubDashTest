import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { NAVIGATION } from '../lib/navigation';
import { useAuth } from '../lib/auth/AuthContext';
import { Avatar } from '../components/ui/Avatar';

/**
 * RH & Finance reprend maintenant l'habillage sombre "Virtus" du hub —
 * demande explicite du 14/09/2026, qui remplace la charte claire propre
 * (logo GD&A, orange #ff6a3a/#d03e0d) restaurée le 11/09/2026. Toutes les
 * autres apps métier gardent pour l'instant leur identité propre : cette
 * bascule se fait app par app.
 */
function estActif(chemin: string, href: string, estRacine: boolean) {
  // La racine du module (« Tableau de bord ») est un prefixe de toutes les
  // autres routes RH (/rh/absences, /rh/annuaire…) : sans ce cas particulier,
  // elle reste allumee sur chaque page au lieu de la page reellement active.
  if (estRacine) return chemin === href;
  return chemin === href || chemin.startsWith(`${href}/`);
}

const GROUPE = NAVIGATION.find((g) => g.app === 'rh')!;

// Seule entrée du menu RH réservée aux validateurs : la page reste
// accessible en direct (le backend la filtre déjà à ce qui vous concerne),
// mais l'afficher à un simple salarié qui n'a jamais rien à valider n'est
// que du bruit — voir l'état vide "Aucun dossier en attente" du tableau
// de bord. Tout le reste (congés, présences, historique, annuaire...) est
// déjà scopé par le backend à l'agent (+ son équipe s'il encadre, + tout
// pour le back-office RH) : pas besoin de le cacher, ça reste pertinent.
const HREF_VALIDATION = '/rh/validations';

function estVisible(href: string, utilisateur: ReturnType<typeof useAuth>['utilisateur']) {
  if (href !== HREF_VALIDATION) return true;
  if (!utilisateur) return false;
  return utilisateur.est_encadrant || utilisateur.role !== 'SALARIE';
}

export default function RhLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';
  const elementsVisibles = GROUPE.items.filter((item) => estVisible(item.href, utilisateur));

  return (
    <div
      className="flex h-screen w-full bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/motif-orange.jpg')" }}
    >
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

        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {elementsVisibles.map((item) => {
            const Icon = item.icon;
            const actif = estActif(pathname, item.href, item.href === GROUPE.items[0].href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  actif ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
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

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-4 backdrop-blur-md sm:justify-end sm:px-8">
          <Link to="/rh" className="shrink-0 font-display text-base font-bold text-white lg:hidden">
            GDA Hub
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              title="Revenir à GDA Hub"
              className="hidden items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 text-xs font-semibold text-muted backdrop-blur-sm transition hover:text-white sm:inline-flex"
            >
              <span aria-hidden>&larr;</span>
              GDA Hub
            </Link>

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
