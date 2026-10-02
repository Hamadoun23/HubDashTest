import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { EtatChargement, EtatErreur } from './EtatsGda';
import { useApi } from '../../lib/hooks/useApi';
import { listerProjets, obtenirProjet, obtenirTableauDeBord, type Dashboard, type Projet } from '../../lib/api/chantiers';
import { CLE_DERNIER_CHANTIER } from './Accueil';
import CoquilleChantiers, { langueInitiale } from '../../layouts/CoquilleChantiers';

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
  const chantierId = Number(id);
  const idValide = id !== undefined && Number.isFinite(chantierId);

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



  if (!idValide) {
    return (
      <CoquilleChantiers langue={langue} onLangue={setLangue}>
        <main className="main main--solo gda-legacy">
          <p>Chantier introuvable.</p>
          <Link to="/chantiers/projets">Voir tous les projets →</Link>
        </main>
      </CoquilleChantiers>
    );
  }

  return (
    <CoquilleChantiers langue={langue} onLangue={setLangue} projets={projets.donnees} projetActif={chantierId}>
      <main className="main main--solo gda-legacy">
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
    </CoquilleChantiers>
  );
}
