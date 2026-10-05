import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HardHat, LogOut, Settings } from 'lucide-react';
import '../styles/gda-daily.css';
import '../styles/gda-daily-theme.css';
import { BoutonRetourHub, NavigationApps } from '../components/NavigationApps';
import { BoutonMenu, TiroirMobile } from '../components/TiroirMobile';
import { ClocheNotifications } from '../components/notifications/ClocheNotifications';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../lib/auth/AuthContext';
import { useEspaceExterne } from '../lib/auth/commercialExterne';
import type { Projet } from '../lib/api/chantiers';

export const CLE_LANGUE_CHANTIERS = 'chantiers_langue_ui';

export function langueInitiale(): 'fr' | 'en' {
  try {
    return localStorage.getItem(CLE_LANGUE_CHANTIERS) === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

/**
 * Chantiers dans la même coquille que RH, Jus et Planning : barre latérale du
 * hub (retour au hub, navigation entre applis), en-tête sombre translucide sur
 * le motif orange. L'ancien en-tête « daily » a disparu ; seuls les écrans du
 * chantier gardent leurs composants (styles/gda-daily*.css, sous `.gda-daily`).
 *
 * En-tête : chantier actif (sélecteur) et langue du rapport (FR / EN).
 */
export default function CoquilleChantiers({
  children,
  projets,
  projetActif,
  langue,
  onLangue,
}: {
  children: ReactNode;
  projets?: Projet[] | null;
  projetActif?: number;
  langue: 'fr' | 'en';
  onLangue: (l: 'fr' | 'en') => void;
}) {
  const [menuMobile, setMenuMobile] = useState(false);
  const fermerMenu = useCallback(() => setMenuMobile(false), []);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { utilisateur, identite, deconnecter } = useAuth();
  const externe = useEspaceExterne() !== null;

  useEffect(() => setMenuMobile(false), [pathname]);

  const nomAffiche = utilisateur?.nom_complet || identite?.nom_complet || utilisateur?.username || '—';
  const fonction = utilisateur?.poste || identite?.fonction || '';

  function changerLangue(l: 'fr' | 'en') {
    try {
      localStorage.setItem(CLE_LANGUE_CHANTIERS, l);
    } catch {
      /* stockage indisponible : la langue vaut pour la session */
    }
    onLangue(l);
  }

  function seDeconnecter() {
    deconnecter();
    navigate('/connexion');
  }

  // Même barre latérale sur grand écran et dans le tiroir mobile.
  const barreLaterale = (
    <aside className="hidden h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-surface backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <Link to="/chantiers" className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow">
            <img src="/logo-gda.png" alt="GD&amp;A" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-lg font-bold tracking-tight text-white">{externe ? 'GDA Chantiers' : 'GDA Hub'}</p>
            <p className="truncate text-xs text-muted">Chantiers</p>
          </div>
        </Link>
      </div>

      {!externe && (
        <div className="px-3 pb-3">
          <BoutonRetourHub />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <NavigationApps onNaviguer={fermerMenu} />
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
          <div className="flex flex-1 items-center gap-3 overflow-hidden">
            <Avatar label={nomAffiche} size={36} moi />
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-sm font-semibold text-white">{nomAffiche}</p>
              <p className="truncate text-xs text-muted">{fonction}</p>
            </div>
          </div>
          <button onClick={seDeconnecter} title="Se déconnecter" className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-white">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen w-full bg-cover bg-center bg-fixed text-white" style={{ backgroundImage: "url('/motif-orange.jpg')" }}>
      {barreLaterale}
      <TiroirMobile ouvert={menuMobile} onFermer={fermerMenu}>
        {barreLaterale}
      </TiroirMobile>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-border bg-surface/40 px-4 py-4 backdrop-blur-md sm:px-8">
          <BoutonMenu onClick={() => setMenuMobile(true)} className="lg:hidden" />

          {/* Chantier actif : passer d'un chantier à l'autre sans quitter l'écran. */}
          {projets && projets.length > 0 && projetActif ? (
            <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md">
              <HardHat size={18} className="hidden shrink-0 text-accent2 sm:block" />
              <select
                aria-label="Chantier actif"
                value={String(projetActif)}
                onChange={(e) => navigate(`/chantiers/${e.target.value}`)}
                className="w-full min-w-0 truncate rounded-xl border border-border bg-surface2 px-3 py-2 text-sm font-semibold text-white focus:border-accent focus:outline-none"
              >
                {projets.map((p) => (
                  <option key={p.id} value={String(p.id)} className="bg-[#1a130e]">
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="min-w-0 flex-1 truncate font-display text-base font-bold text-white">Chantiers</p>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex rounded-full border border-border bg-surface2 p-0.5 text-xs font-bold" role="group" aria-label="Langue du rapport">
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changerLangue(l)}
                  className={`rounded-full px-2.5 py-1 ${langue === l ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <ClocheNotifications />

            <div className="relative hidden sm:block">
              <button
                onClick={() => setMenuOuvert((v) => !v)}
                className="flex items-center gap-2.5 rounded-full border border-border bg-surface2 py-1.5 pl-1.5 pr-3 backdrop-blur-sm transition hover:bg-surface"
              >
                <Avatar label={nomAffiche} size={28} moi />
                <span className="text-left leading-tight">
                  <span className="block text-sm font-medium text-white">{nomAffiche}</span>
                  <span className="block text-[11px] text-muted">{fonction}</span>
                </span>
              </button>
              {menuOuvert && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg backdrop-blur-xl">
                    {!externe && (
                      <Link to="/mon-compte" onClick={() => setMenuOuvert(false)} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted hover:bg-surface2 hover:text-white">
                        <Settings size={14} />
                        Mon compte
                      </Link>
                    )}
                    <button onClick={seDeconnecter} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10">
                      <LogOut size={14} />
                      Se déconnecter
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main data-defilement className="flex-1 overflow-y-auto">
          {/* Les écrans du chantier gardent leurs composants : ils vivent sous
              `.gda-daily`, sans plus aucune coquille propre (cf. index.css). */}
          <div className="gda-daily gda-dans-hub mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
