import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import '../../styles/gda-daily.css';
import '../../styles/gda-daily-theme.css';
import { useAuth } from '../../lib/auth/AuthContext';
import { EtatChargement, EtatErreur } from './EtatsGda';
import { useApi } from '../../lib/hooks/useApi';
import { BoutonRetourHub, NavigationApps } from '../../components/NavigationApps';
import { useEspaceExterne } from '../../lib/auth/commercialExterne';
import { listerProjets, obtenirProjet, obtenirTableauDeBord, type Dashboard, type Projet } from '../../lib/api/chantiers';
import { CLE_DERNIER_CHANTIER } from './Accueil';
import EnteteGda, { STYLE_COQUILLE, langueInitiale } from './EnteteGda';

const ROLES_INTERNES = ['admin', 'chef_chantier', 'ingenieur', 'controle_qualite'];

export type ContexteChantier = {
  projet: Projet;
  recharger: () => void;
  tableau: Dashboard | null;
  rechargerTableau: () => void;
  estPartenaire: boolean;
  langue: 'fr' | 'en';
};

/** Partenaire externe (lecture seule), jamais un membre de l'équipe interne — même règle que `hub.UtilisateurHub`. */
export function useEstPartenaire() {
  const { identite, habilitations } = useAuth();
  const roles = habilitations.daily ?? [];
  // « direction » voit tout mais n'écrit pas : même interface sans édition
  // que le partenaire (le serveur refuse de toute façon ses écritures).
  return (
    !identite?.est_superadmin &&
    (roles.includes('partenaire') || roles.includes('direction')) &&
    !roles.some((r) => ROLES_INTERNES.includes(r))
  );
}

/**
 * Coquille du chantier — reprise à l'identique de daily.gdamali.net :
 * `partials/gda-header.blade.php`, `chantier/partials/sidebar.blade.php` et
 * `public/css/gda.css` (copié, limité à `.gda-daily`, cf. styles/gda-daily.css).
 */
export default function ChantierLayout() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const chantierId = Number(id);
  const idValide = id !== undefined && Number.isFinite(chantierId);

  const [sidebarOuverte, setSidebarOuverte] = useState(false);
  const externe = useEspaceExterne() !== null;
  const [langue, setLangue] = useState(langueInitiale);
  const estPartenaire = useEstPartenaire();

  const { donnees: projet, chargement, erreur, recharger } = useApi(() => obtenirProjet(chantierId), [chantierId]);
  // Rechargé à chaque changement de page : la progression de la sidebar suit
  // les saisies faites ailleurs, comme `refreshSidebar()` côté Laravel.
  const tableau = useApi(() => obtenirTableauDeBord(chantierId), [chantierId, pathname]);
  const projets = useApi(listerProjets, []);

  useEffect(() => {
    if (projet) localStorage.setItem(CLE_DERNIER_CHANTIER, String(projet.id));
  }, [projet]);

  useEffect(() => {
    setSidebarOuverte(false);
  }, [pathname]);

  const progression = tableau.donnees?.overall_progress ?? projet?.overall_progress ?? 0;
  const derniereMaj = tableau.donnees?.recent_activity[0]?.time ?? '—';
  const base = `/chantiers/${chantierId}`;
  const classeNav = ({ isActive }: { isActive: boolean }) => `nav-item${isActive ? ' active' : ''}`;

  if (!idValide) {
    return (
      <div className="gda-daily" style={STYLE_COQUILLE}>
        <main className="main main--solo gda-legacy">
          <p>Chantier introuvable.</p>
          <Link to="/chantiers/projets">Voir tous les projets →</Link>
        </main>
      </div>
    );
  }

  return (
    <div className={`gda-daily has-sidebar${sidebarOuverte ? ' sidebar-open' : ''}`} style={STYLE_COQUILLE}>
      <EnteteGda
        libelle={projet?.name ?? ''}
        chantier
        langue={langue}
        onLangue={setLangue}
        onMenu={() => setSidebarOuverte((v) => !v)}
        menuOuvert={sidebarOuverte}
      />

      <div className={`sidebar-backdrop${sidebarOuverte ? ' is-visible' : ''}`} aria-hidden="true" onClick={() => setSidebarOuverte(false)} />

      {/* ===== SIDEBAR ===== */}
      <nav className={`sidebar gda-legacy${sidebarOuverte ? ' is-open' : ''}`}>
        {/* Même entrée que les autres applis : retour au hub bien visible
            (jamais pour un partenaire externe, qui n'a pas de hub). */}
        {!externe && (
          <div style={{ padding: '14px 14px 6px' }}>
            <BoutonRetourHub />
          </div>
        )}
        <div className="sidebar-section">Chantier</div>
        <NavLink to={base} end className={classeNav}>
          <span className="nav-icon">◈</span> <span>Tableau de bord</span>
        </NavLink>
        <div className="sidebar-project-switch">
          <label className="sidebar-project-caption" htmlFor="sidebar-project-select">
            Projet actif
          </label>
          <select
            className="sidebar-project-select"
            id="sidebar-project-select"
            aria-label="Changer de projet"
            value={projet ? String(projet.id) : ''}
            onChange={(e) => navigate(`/chantiers/${e.target.value}`)}
          >
            {!projets.donnees && <option value="">Chargement…</option>}
            {(projets.donnees ?? []).map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {!estPartenaire && (
          <NavLink to={`${base}/saisie`} className={classeNav}>
            <span className="nav-icon">✎</span> <span>Saisie du jour</span>
          </NavLink>
        )}
        <NavLink to={`${base}/taches`} className={classeNav}>
          <span className="nav-icon">≡</span> <span>Toutes les tâches</span>
        </NavLink>
        {!estPartenaire && (
          <NavLink to={`${base}/photos`} className={classeNav}>
            <span className="nav-icon">◉</span> <span>Galerie photos</span>
          </NavLink>
        )}
        <NavLink to={`${base}/rapport`} className={classeNav}>
          <span className="nav-icon">◻</span> <span>Rapport PDF</span>
        </NavLink>

        <div className="sidebar-section sidebar-section--forecast">Prévisions</div>
        <NavLink to={`${base}/meteo`} className={classeNav}>
          <span className="nav-icon">⛅</span> <span>Prévisions météo</span>
        </NavLink>

        {!estPartenaire && (
          <>
            <div className="sidebar-section">Gestion</div>
            <Link to="/chantiers/projets" className="nav-item nav-item--link">
              <span className="nav-icon">▣</span>
              <span>Tous les chantiers</span>
            </Link>
          </>
        )}

        <div style={{ padding: '16px 16px 0' }}>
          <div className="sidebar-progress">
            <div className="sp-label">Progression globale</div>
            <div className="sp-num">{Math.round(progression)}%</div>
            <div className="sp-bar">
              <div className="sp-fill" style={{ width: `${progression}%` }} />
            </div>
          </div>
        </div>

        {/* Passer directement à une autre appli, comme dans RH, Jus, Planning. */}
        {!externe && (
          <div style={{ padding: '18px 10px 4px' }}>
            <NavigationApps exclure="chantiers" titre="Autres applications" onNaviguer={() => setSidebarOuverte(false)} />
          </div>
        )}

        <div className="sidebar-footer">
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
            {projet?.name ?? 'Chargement…'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            <span>Mise à jour:</span> <span>{derniereMaj}</span>
          </div>
        </div>
      </nav>

      {/* ===== MAIN ===== */}
      <main className="main">
        {chargement ? (
          <EtatChargement texte="Chargement du chantier…" />
        ) : erreur || !projet ? (
          <EtatErreur message={erreur ?? 'Chantier introuvable'} recharger={recharger} />
        ) : (
          <Outlet
            context={
              {
                projet,
                recharger,
                tableau: tableau.donnees,
                rechargerTableau: tableau.recharger,
                estPartenaire,
                langue,
              } satisfies ContexteChantier
            }
          />
        )}
      </main>
    </div>
  );
}
