import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './lib/auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import Accueil from './pages/Accueil';
import Administration from './pages/Administration';
import Connexion from './pages/Connexion';
import MonCompte from './pages/MonCompte';

import ChantierLayout from './pages/chantiers/ChantierLayout';
import ChantiersDetail from './pages/chantiers/Detail';
import Journal from './pages/chantiers/Journal';
import ChantiersListe from './pages/chantiers/Liste';
import Meteo from './pages/chantiers/Meteo';
import Photos from './pages/chantiers/Photos';
import Rapport from './pages/chantiers/Rapport';
import SaisieDuJour from './pages/chantiers/SaisieDuJour';
import Structure from './pages/chantiers/Structure';
import Taches from './pages/chantiers/Taches';

import Commercial from './pages/jus/Commercial';
import Direction from './pages/jus/Direction';
import Finance from './pages/jus/Finance';
import Production from './pages/jus/Production';
import Reporting from './pages/jus/Reporting';
import Tresorerie from './pages/jus/Tresorerie';
import Utilisateurs from './pages/jus/Utilisateurs';

import ClientsCommercial from './pages/jus/commercial/Clients';
import Commandes from './pages/jus/commercial/Commandes';
import Factures from './pages/jus/commercial/Factures';
import Paiements from './pages/jus/commercial/Paiements';
import Prospection from './pages/jus/commercial/Prospection';
import Ventes from './pages/jus/commercial/Ventes';

import Articles from './pages/jus/production/Articles';
import Bouteilles from './pages/jus/production/Bouteilles';
import Conditionnements from './pages/jus/production/Conditionnements';
import Cueillettes from './pages/jus/production/Cueillettes';
import Inventaires from './pages/jus/production/Inventaires';
import Producteurs from './pages/jus/production/Producteurs';
import Productions from './pages/jus/production/Productions';
import Receptions from './pages/jus/production/Receptions';

import Appro from './pages/jus/reporting/Appro';
import Distribution from './pages/jus/reporting/Distribution';
import Emballage from './pages/jus/reporting/Emballage';
import Entrepot from './pages/jus/reporting/Entrepot';
import Fabrication from './pages/jus/reporting/Fabrication';
import Recolte from './pages/jus/reporting/Recolte';

import Clients from './pages/planning/Clients';
import IdeesContenu from './pages/planning/IdeesContenu';
import Publications from './pages/planning/Publications';
import TableauDeBordPlanning from './pages/planning/TableauDeBord';
import Tournages from './pages/planning/Tournages';

import CampagnesTableauDeBord from './pages/campagnes/TableauDeBord';
import CampagnesVentes from './pages/campagnes/Ventes';
import CampagnesEnrolements from './pages/campagnes/Enrolements';
import CampagnesListe from './pages/campagnes/admin/Liste';
import CampagnesCreer from './pages/campagnes/admin/Creer';
import CampagnesDetail from './pages/campagnes/admin/Detail';
import CampagnesPerformances from './pages/campagnes/Performances';
import CampagnesMonContrat from './pages/campagnes/MonContrat';

import Absences from './pages/rh/Absences';
import Annuaire from './pages/rh/Annuaire';
import Historique from './pages/rh/Historique';
import MesDemandes from './pages/rh/MesDemandes';
import MonEspace from './pages/rh/MonEspace';
import Organisation from './pages/rh/Organisation';
import Permissions from './pages/rh/Permissions';
import Presences from './pages/rh/Presences';
import Retards from './pages/rh/Retards';
import TableauDeBordRh from './pages/rh/TableauDeBord';
import Validations from './pages/rh/Validations';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />

          <Route element={<RequireAuth />}>
            <Route element={<App />}>
              <Route path="/" element={<Accueil />} />
          <Route path="/administration" element={<Administration />} />
          <Route path="/mon-compte" element={<MonCompte />} />

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

          <Route path="/jus/commercial" element={<Commercial />} />
          <Route path="/jus/commercial/prospection" element={<Prospection />} />
          <Route path="/jus/commercial/clients" element={<ClientsCommercial />} />
          <Route path="/jus/commercial/ventes" element={<Ventes />} />
          <Route path="/jus/commercial/commandes" element={<Commandes />} />
          <Route path="/jus/commercial/factures" element={<Factures />} />
          <Route path="/jus/commercial/paiements" element={<Paiements />} />

          <Route path="/jus/production" element={<Production />} />
          <Route path="/jus/production/producteurs" element={<Producteurs />} />
          <Route path="/jus/production/cueillettes" element={<Cueillettes />} />
          <Route path="/jus/production/articles" element={<Articles />} />
          <Route path="/jus/production/receptions" element={<Receptions />} />
          <Route path="/jus/production/productions" element={<Productions />} />
          <Route path="/jus/production/conditionnements" element={<Conditionnements />} />
          <Route path="/jus/production/bouteilles" element={<Bouteilles />} />
          <Route path="/jus/production/inventaires" element={<Inventaires />} />

          <Route path="/jus/finance" element={<Finance />} />
          <Route path="/jus/finance/tresorerie" element={<Tresorerie />} />

          <Route path="/jus/direction" element={<Direction />} />
          <Route path="/jus/direction/utilisateurs" element={<Utilisateurs />} />

          <Route path="/jus/reporting" element={<Reporting />} />
          <Route path="/jus/reporting/recolte" element={<Recolte />} />
          <Route path="/jus/reporting/appro" element={<Appro />} />
          <Route path="/jus/reporting/fabrication" element={<Fabrication />} />
          <Route path="/jus/reporting/emballage" element={<Emballage />} />
          <Route path="/jus/reporting/entrepot" element={<Entrepot />} />
          <Route path="/jus/reporting/distribution" element={<Distribution />} />

          <Route path="/chantiers" element={<ChantiersListe />} />
          <Route path="/chantiers/:id" element={<ChantierLayout />}>
            <Route index element={<ChantiersDetail />} />
            <Route path="saisie" element={<SaisieDuJour />} />
            <Route path="taches" element={<Taches />} />
            <Route path="photos" element={<Photos />} />
            <Route path="structure" element={<Structure />} />
            <Route path="journal" element={<Journal />} />
            <Route path="meteo" element={<Meteo />} />
            <Route path="rapport" element={<Rapport />} />
          </Route>

              <Route path="/planning" element={<TableauDeBordPlanning />} />
              <Route path="/planning/clients" element={<Clients />} />
              <Route path="/planning/idees-contenu" element={<IdeesContenu />} />
              <Route path="/planning/tournages" element={<Tournages />} />
              <Route path="/planning/publications" element={<Publications />} />

              <Route path="/campagnes" element={<CampagnesTableauDeBord />} />
              <Route path="/campagnes/ventes" element={<CampagnesVentes />} />
              <Route path="/campagnes/enrolements" element={<CampagnesEnrolements />} />
              <Route path="/campagnes/admin/campagnes" element={<CampagnesListe />} />
              <Route path="/campagnes/admin/campagnes/creer" element={<CampagnesCreer />} />
              <Route path="/campagnes/admin/campagnes/:id" element={<CampagnesDetail />} />
              <Route path="/campagnes/performances" element={<CampagnesPerformances />} />
              <Route path="/campagnes/mon-contrat" element={<CampagnesMonContrat />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
