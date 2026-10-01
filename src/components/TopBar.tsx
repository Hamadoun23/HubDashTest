import { LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { ClocheNotifications } from './notifications/ClocheNotifications';
import { BoutonMenu } from './TiroirMobile';
import { Avatar } from './ui/Avatar';

/**
 * Barre du haut de la coquille du hub : menu (petit écran), notifications,
 * compte connecté. Remplace l'ancienne maquette (« Membre Pro »,
 * « Portfolio », avatars et nom écrits en dur).
 */
export function TopBar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const { identite, utilisateur, deconnecter } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const nom = identite?.nom_complet || utilisateur?.nom_complet || identite?.identifiant || '—';
  const sousTitre = identite?.fonction || utilisateur?.poste || '';

  return (
    <header
      className="flex items-center gap-3 border-b border-border bg-surface/40 px-4 py-3 backdrop-blur-md sm:px-8 sm:py-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <BoutonMenu onClick={onMenu} />
      <Link to="/" className="font-display text-base font-bold text-white lg:hidden">
        GDA Hub
      </Link>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ClocheNotifications />

        <div className="relative">
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            className="flex items-center gap-2.5 rounded-full border border-border bg-surface2 py-1.5 pl-1.5 pr-1.5 backdrop-blur-sm transition hover:bg-surface sm:pr-3"
          >
            <Avatar label={nom} size={30} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[180px] truncate text-sm font-medium text-white">{nom}</span>
              {sousTitre && <span className="block max-w-[180px] truncate text-[11px] text-muted">{sousTitre}</span>}
            </span>
          </button>

          {ouvert && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOuvert(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-[#1a130e]/95 p-1.5 shadow-lg backdrop-blur-xl">
                <div className="px-2.5 py-2 sm:hidden">
                  <p className="truncate text-sm font-medium text-white">{nom}</p>
                  {sousTitre && <p className="truncate text-xs text-muted">{sousTitre}</p>}
                </div>
                <Link
                  to="/mon-compte"
                  onClick={() => setOuvert(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted hover:bg-surface2 hover:text-white"
                >
                  <Settings size={14} />
                  Mon compte
                </Link>
                <button
                  type="button"
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
  );
}
