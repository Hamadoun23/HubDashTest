import { useEffect, useState } from 'react';
import { ClocheNotifications } from '../../components/notifications/ClocheNotifications';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { useEspaceExterne } from '../../lib/auth/commercialExterne';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirMeteoActuelle } from '../../lib/api/chantiers';

// Coordonnées de Bamako (siège du groupe) — voir la même constante dans Meteo.tsx.
const LAT_DEFAUT = 12.6392;
const LON_DEFAUT = -8.0029;
export const CLE_LANGUE_CHANTIERS = 'chantiers_langue_ui';

/** Fond de la coquille Chantiers : motif orange GDA derrière, photo de chantier dans l'en-tête. */
export const STYLE_COQUILLE = {
  '--gda-header-bg': "url('/chantiers-motif.png')",
  backgroundImage: "url('/motif-orange.jpg')",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed',
} as React.CSSProperties;

export function langueInitiale(): 'fr' | 'en' {
  return localStorage.getItem(CLE_LANGUE_CHANTIERS) === 'en' ? 'en' : 'fr';
}

/** Code météo WMO (Open-Meteo) -> même jeu d'emojis que `weatherIconEmoji` (gda-app.js). */
function emojiMeteo(code: number | undefined): string {
  if (code === undefined) return '🌡️';
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

function MeteoEntete() {
  const meteo = useApi(() => obtenirMeteoActuelle(LAT_DEFAUT, LON_DEFAUT), []);
  const courant = meteo.donnees?.current as { temperature_2m?: number; weather_code?: number } | undefined;
  if (courant?.temperature_2m === undefined) return null;
  return (
    <div className="header-weather" aria-live="polite">
      <span className="header-weather__sep" aria-hidden="true" />
      <span className="header-weather__emoji" aria-hidden="true">
        {emojiMeteo(courant.weather_code)}
      </span>
      <span className="header-weather__temp">{Math.round(courant.temperature_2m)}°C</span>
      <span className="header-weather__city">Bamako</span>
    </div>
  );
}

/**
 * En-tête de daily.gdamali.net (`partials/gda-header.blade.php`) : logo, libellé
 * (nom du projet ou « Gestion des projets »), date et météo sur le chantier,
 * bascule FR/EN, compte utilisateur « Rester / Se déconnecter ».
 */
export default function EnteteGda({
  libelle,
  chantier,
  langue,
  onLangue,
  onMenu,
  menuOuvert = false,
}: {
  libelle: string;
  chantier: boolean;
  langue: 'fr' | 'en';
  onLangue: (l: 'fr' | 'en') => void;
  onMenu?: () => void;
  menuOuvert?: boolean;
}) {
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const externe = useEspaceExterne() !== null;
  const [popover, setPopover] = useState(false);
  const [horloge, setHorloge] = useState(new Date());

  useEffect(() => {
    if (!chantier) return;
    const minuteur = setInterval(() => setHorloge(new Date()), 30_000);
    return () => clearInterval(minuteur);
  }, [chantier]);

  function changerLangue(l: 'fr' | 'en') {
    localStorage.setItem(CLE_LANGUE_CHANTIERS, l);
    onLangue(l);
  }

  const nom = utilisateur?.nom_complet || utilisateur?.username || '—';

  return (
    <header className="header gda-legacy">
      {onMenu && (
        <button type="button" className="header-menu-btn" aria-label="Menu" aria-expanded={menuOuvert} onClick={onMenu}>
          <span className="header-menu-btn__bar" />
          <span className="header-menu-btn__bar" />
          <span className="header-menu-btn__bar" />
        </button>
      )}
      <Link to="/chantiers" className="logo">
        <img src="/gdaconst.png" alt="GDA" className="brand-logo brand-logo--header" />
      </Link>
      <div className="header-sep" />
      <div className="project-label" title={libelle}>
        {libelle}
      </div>
      <div className="header-spacer" />
      {chantier && (
        <>
          <div className="header-datetime" aria-label="Date et météo">
            <div className="date-live">
              {horloge.toLocaleString(langue === 'en' ? 'en-GB' : 'fr-FR', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <MeteoEntete />
          </div>
          <div style={{ width: 12 }} />
        </>
      )}
      <div className="header-lang" role="group" aria-label="Language">
        <span className="header-lang__lbl">Langue</span>
        <div className="header-lang__toggle">
          <button type="button" className={`header-lang__btn${langue === 'fr' ? ' header-lang__btn--on' : ''}`} onClick={() => changerLangue('fr')}>
            FR
          </button>
          <button type="button" className={`header-lang__btn${langue === 'en' ? ' header-lang__btn--on' : ''}`} onClick={() => changerLangue('en')}>
            EN
          </button>
        </div>
      </div>
      {/* Un partenaire externe n'a pas de hub où revenir. */}
      {!externe && (
        <>
          <div style={{ width: 12 }} />
          <Link
            to="/"
            className="btn btn-primary"
            title="Revenir à l'accueil de GDA Hub"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '8px 16px', whiteSpace: 'nowrap' }}
          >
            ← Retour au hub
          </Link>
        </>
      )}
      <div style={{ width: 12 }} />
      <ClocheNotifications />
      <div style={{ width: 12 }} />
      <div className="header-user-wrap">
        <div className="user-pill" role="button" tabIndex={0} aria-haspopup="true" aria-expanded={popover} onClick={() => setPopover((v) => !v)}>
          <div className="user-avatar">{(nom.trim()[0] ?? '?').toUpperCase()}</div>
          <div className="user-name">{nom}</div>
        </div>
        <div className={`logout-popover${popover ? ' is-open' : ''}`} role="menu" aria-hidden={!popover}>
          <button type="button" className="logout-popover__btn" onClick={() => setPopover(false)}>
            Rester
          </button>
          <button
            type="button"
            className="logout-popover__btn logout-popover__btn--out"
            onClick={() => {
              deconnecter();
              navigate('/connexion');
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </header>
  );
}
