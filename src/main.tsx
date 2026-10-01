import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './lib/auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { FiletErreur } from './components/FiletErreur';
import Connexion from './pages/Connexion';



// Chaque écran est chargé à la demande : le premier affichage (connexion,
// accueil) ne télécharge pas le code de toutes les applications.
const ProjetsChantiers = lazy(() => import('./pages/chantiers/Projets'));
const RedirectionStructure = lazy(() => import('./pages/chantiers/Projets').then((m) => ({ default: m.RedirectionStructure })));
const Accueil = lazy(() => import('./pages/Accueil'));
const Administration = lazy(() => import('./pages/Administration'));
const NouveauCompte = lazy(() => import('./pages/administration/NouveauCompte'));
const DetailCompte = lazy(() => import('./pages/administration/DetailCompte'));
const NouveauDepartement = lazy(() => import('./pages/administration/NouveauDepartement'));
const DetailDepartement = lazy(() => import('./pages/administration/DetailDepartement'));
const DetailApplication = lazy(() => import('./pages/administration/DetailApplication'));
const MonCompte = lazy(() => import('./pages/MonCompte'));
const Notifications = lazy(() => import('./pages/Notifications'));
const HoteCampagnes = lazy(() => import('./campagnes/HoteCampagnes'));
const JusLayout = lazy(() => import('./layouts/JusLayout'));
const RhLayout = lazy(() => import('./layouts/RhLayout'));
const PlanningLayout = lazy(() => import('./layouts/PlanningLayout'));
const AccueilChantiers = lazy(() => import('./pages/chantiers/Accueil'));
const ChantierLayout = lazy(() => import('./pages/chantiers/ChantierLayout'));
const ChantiersDetail = lazy(() => import('./pages/chantiers/Detail'));
const Meteo = lazy(() => import('./pages/chantiers/Meteo'));
const Photos = lazy(() => import('./pages/chantiers/Photos'));
const Rapport = lazy(() => import('./pages/chantiers/Rapport'));
const SaisieDuJour = lazy(() => import('./pages/chantiers/SaisieDuJour'));
const Taches = lazy(() => import('./pages/chantiers/Taches'));
const TableauDeBordJus = lazy(() => import('./pages/jus/TableauDeBord'));
const Reporting = lazy(() => import('./pages/jus/Reporting'));
const Tresorerie = lazy(() => import('./pages/jus/Tresorerie'));
const Utilisateurs = lazy(() => import('./pages/jus/Utilisateurs'));
const ClientsCommercial = lazy(() => import('./pages/jus/commercial/Clients'));
const Commandes = lazy(() => import('./pages/jus/commercial/Commandes'));
const Factures = lazy(() => import('./pages/jus/commercial/Factures'));
const Paiements = lazy(() => import('./pages/jus/commercial/Paiements'));
const Prospection = lazy(() => import('./pages/jus/commercial/Prospection'));
const Ventes = lazy(() => import('./pages/jus/commercial/Ventes'));
const Articles = lazy(() => import('./pages/jus/production/Articles'));
const Bouteilles = lazy(() => import('./pages/jus/production/Bouteilles'));
const Conditionnements = lazy(() => import('./pages/jus/production/Conditionnements'));
const Cueillettes = lazy(() => import('./pages/jus/production/Cueillettes'));
const Inventaires = lazy(() => import('./pages/jus/production/Inventaires'));
const Producteurs = lazy(() => import('./pages/jus/production/Producteurs'));
const Productions = lazy(() => import('./pages/jus/production/Productions'));
const Receptions = lazy(() => import('./pages/jus/production/Receptions'));
const Appro = lazy(() => import('./pages/jus/reporting/Appro'));
const Distribution = lazy(() => import('./pages/jus/reporting/Distribution'));
const Emballage = lazy(() => import('./pages/jus/reporting/Emballage'));
const Entrepot = lazy(() => import('./pages/jus/reporting/Entrepot'));
const Fabrication = lazy(() => import('./pages/jus/reporting/Fabrication'));
const Recolte = lazy(() => import('./pages/jus/reporting/Recolte'));
const Clients = lazy(() => import('./pages/planning/Clients'));
const DetailClientPlanning = lazy(() => import('./pages/planning/DetailClient'));
const IdeesContenu = lazy(() => import('./pages/planning/IdeesContenu'));
const Publications = lazy(() => import('./pages/planning/Publications'));
const Statistiques = lazy(() => import('./pages/planning/Statistiques'));
const TableauDeBordPlanning = lazy(() => import('./pages/planning/TableauDeBord'));
const Tournages = lazy(() => import('./pages/planning/Tournages'));
const Absences = lazy(() => import('./pages/rh/Absences'));
const Annuaire = lazy(() => import('./pages/rh/Annuaire'));
const Historique = lazy(() => import('./pages/rh/Historique'));
const MesDemandes = lazy(() => import('./pages/rh/MesDemandes'));
const MonEspace = lazy(() => import('./pages/rh/MonEspace'));
const Organisation = lazy(() => import('./pages/rh/Organisation'));
const Permissions = lazy(() => import('./pages/rh/Permissions'));
const Presences = lazy(() => import('./pages/rh/Presences'));
const Retards = lazy(() => import('./pages/rh/Retards'));
const TableauDeBordRh = lazy(() => import('./pages/rh/TableauDeBord'));
const Validations = lazy(() => import('./pages/rh/Validations'));
const RequisitionDetail = lazy(() => import('./pages/finance/RequisitionDetail'));








createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <FiletErreur>
        <Suspense
          fallback={
            <div className="flex h-screen w-full items-center justify-center bg-bg">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            </div>
          }
        >
        <Routes>
          <Route path="/connexion" element={<Connexion />} />

          <Route element={<RequireAuth />}>
            {/* Coquille du hub — seule à porter l'habillage sombre "Virtus" :
                accueil, administration, mon compte. Voir retrogradeAppmetier.md. */}
            <Route element={<App />}>
              <Route path="/" element={<Accueil />} />
              <Route path="/administration" element={<Administration />} />
              <Route path="/administration/nouveau-compte" element={<NouveauCompte />} />
              <Route path="/administration/comptes/:id" element={<DetailCompte />} />
              <Route path="/administration/nouveau-departement" element={<NouveauDepartement />} />
              <Route path="/administration/departements/:id" element={<DetailDepartement />} />
              <Route path="/administration/applications/:id" element={<DetailApplication />} />
              <Route path="/mon-compte" element={<MonCompte />} />
              <Route path="/notifications" element={<Notifications />} />
            </Route>

            {/* Campagnes : les écrans de BDM, servis par le pont Inertia
                (src/campagnes/). Chaque adresse #/campagnes/... est celle du
                service, une à une. */}
            <Route path="/campagnes/*" element={<HoteCampagnes />} />

            {/* Chaque app métier reprend son identité visuelle propre — la
                sidebar du hub ne fait plus que rediriger vers sa racine. */}
            <Route element={<RhLayout />}>
              <Route path="/rh" element={<TableauDeBordRh />} />
              <Route path="/rh/absences" element={<Absences />} />
              <Route path="/rh/annuaire" element={<Annuaire />} />
              <Route path="/rh/historique" element={<Historique />} />
              <Route path="/rh/mes-demandes" element={<MesDemandes />} />
              <Route path="/rh/mon-espace" element={<MonEspace />} />
              <Route path="/rh/organisation" element={<Organisation />} />
              <Route path="/rh/permissions" element={<Permissions />} />
              <Route path="/rh/presences" element={<Presences />} />
              <Route path="/rh/retards" element={<Retards />} />
              <Route path="/rh/validations" element={<Validations />} />
              <Route path="/rh/requisitions/:id" element={<RequisitionDetail />} />
            </Route>

            <Route element={<JusLayout />}>
              <Route path="/jus" element={<TableauDeBordJus />} />
              {/* Alias historiques (raccourci du hub, anciens favoris) — même
                  tableau de bord unique, pas quatre écrans par domaine. */}
              <Route path="/jus/direction" element={<TableauDeBordJus />} />
              <Route path="/jus/production" element={<TableauDeBordJus />} />
              <Route path="/jus/commercial" element={<TableauDeBordJus />} />
              <Route path="/jus/finance" element={<TableauDeBordJus />} />

              <Route path="/jus/commercial/prospection" element={<Prospection />} />
              <Route path="/jus/commercial/clients" element={<ClientsCommercial />} />
              <Route path="/jus/commercial/ventes" element={<Ventes />} />
              <Route path="/jus/commercial/commandes" element={<Commandes />} />
              <Route path="/jus/commercial/factures" element={<Factures />} />
              <Route path="/jus/commercial/paiements" element={<Paiements />} />

              <Route path="/jus/production/producteurs" element={<Producteurs />} />
              <Route path="/jus/production/cueillettes" element={<Cueillettes />} />
              <Route path="/jus/production/articles" element={<Articles />} />
              <Route path="/jus/production/receptions" element={<Receptions />} />
              <Route path="/jus/production/productions" element={<Productions />} />
              <Route path="/jus/production/conditionnements" element={<Conditionnements />} />
              <Route path="/jus/production/bouteilles" element={<Bouteilles />} />
              <Route path="/jus/production/inventaires" element={<Inventaires />} />

              <Route path="/jus/finance/tresorerie" element={<Tresorerie />} />

              <Route path="/jus/direction/utilisateurs" element={<Utilisateurs />} />

              <Route path="/jus/reporting" element={<Reporting />} />
              <Route path="/jus/reporting/recolte" element={<Recolte />} />
              <Route path="/jus/reporting/appro" element={<Appro />} />
              <Route path="/jus/reporting/fabrication" element={<Fabrication />} />
              <Route path="/jus/reporting/emballage" element={<Emballage />} />
              <Route path="/jus/reporting/entrepot" element={<Entrepot />} />
              <Route path="/jus/reporting/distribution" element={<Distribution />} />
            </Route>

            {/* Chaque écran Chantiers porte sa propre coquille (en-tête, et sidebar
                pour un chantier ouvert) — fidèle à daily.gdamali.net. */}
            <Route path="/chantiers" element={<AccueilChantiers />} />
            <Route path="/chantiers/projets" element={<ProjetsChantiers />} />
            <Route path="/chantiers/:id" element={<ChantierLayout />}>
              <Route index element={<ChantiersDetail />} />
              <Route path="saisie" element={<SaisieDuJour />} />
              <Route path="taches" element={<Taches />} />
              <Route path="photos" element={<Photos />} />
              <Route path="structure" element={<RedirectionStructure />} />
              <Route path="meteo" element={<Meteo />} />
              <Route path="rapport" element={<Rapport />} />
            </Route>

            <Route element={<PlanningLayout />}>
              <Route path="/planning" element={<TableauDeBordPlanning />} />
              <Route path="/planning/clients" element={<Clients />} />
              <Route path="/planning/clients/:id" element={<DetailClientPlanning />} />
              <Route path="/planning/idees-contenu" element={<IdeesContenu />} />
              <Route path="/planning/tournages" element={<Tournages />} />
              <Route path="/planning/publications" element={<Publications />} />
              <Route path="/planning/statistiques" element={<Statistiques />} />
            </Route>
          </Route>
        </Routes>
        </Suspense>
        </FiletErreur>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);

// PWA : service worker (cache de l'interface, page hors ligne, notifications
// push). Enregistré après le chargement pour ne pas retarder le premier écran.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
