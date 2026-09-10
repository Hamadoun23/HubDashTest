/** Fonctions domaine pour le service `campagnes` (alias interne « bdm »).
 * Formes de props d'après une lecture directe du code Django/Inertia réel
 * (voir rapport d'exploration) — un portage d'une ancienne app Laravel, donc
 * des formes parfois moins régulières que les autres services du hub. */
import { campagnesApiFetch, campagnesFetch } from './campagnesClient';

export type Flash = { success: string | null; error: string | null; warning: string | null; status: string | null };

export type UtilisateurCampagnes = {
  id: number;
  name: string;
  prenom: string;
  role: 'admin' | 'direction' | 'commercial' | 'commercial_telephonique';
  agence_id: number | null;
  partenaire_id: number | null;
  is_admin: boolean;
  is_direction: boolean;
  is_commercial: boolean;
  is_commercial_telephonique: boolean;
  peut_vendre: boolean;
  peut_enroler: boolean;
  photo: string | null;
};

// --- Tableau de bord -----------------------------------------------------------

export type CampagneResume = { nom: string; date_debut: string; date_fin: string };

export type DashboardAdmin = {
  variant: 'admin' | 'direction';
  user: { display_name: string; is_admin: boolean; agence_nom: string | null };
  readOnly: boolean;
  estEnrolement: boolean;
  ventesTotal: number;
  ventesMois: number;
  venteTrend: number[];
  pctCommerciauxActifs: number;
  classement: { rang: number; user_id: number; user_name: string; total_ventes: number }[];
  campagnesTotal: number;
  campagnesEnCours: number;
  campagnesProgrammees: number;
  campagneActive: CampagneResume | null;
  campagnesActivesListe: CampagneResume[];
  libelleStatsCampagne: string;
  agencesCount: number;
  commerciauxCount: number;
  aDesAgences: boolean;
};

export type DashboardCommercial = {
  variant: 'commercial';
  user: { display_name: string };
  peutVendre: boolean;
  peutEnroler: boolean;
  vente: {
    mesVentes: number;
    monRang: number | null;
    libelleStatsCampagne: string;
    campagneActive: CampagneResume | null;
    campagnesOuvertes: { id: number; nom: string }[];
  };
  enrolement: {
    mesEnrolements: number;
    campagneActive: CampagneResume | null;
    campagnesOuvertes: { id: number; nom: string }[];
  };
};

export type DashboardTelephonique = {
  variant: 'telephonique';
  user: { display_name: string };
  campagneActive: CampagneResume | null;
  signataire: boolean;
};

export type Dashboard = DashboardAdmin | DashboardCommercial | DashboardTelephonique;

export async function obtenirTableauDeBord() {
  const { props } = await campagnesFetch<Dashboard>('/dashboard');
  return props;
}

// --- Ventes (terrain) ------------------------------------------------------------

export type LigneVente = {
  id: number;
  date: string;
  client_nom: string;
  type_carte: string;
  commercial: string;
  agence: string | null;
  peut_modifier_client: boolean;
  peut_supprimer: boolean;
  client_id: number;
};

export type PageVentes = { data: LigneVente[]; current_page: number; last_page: number; per_page: number; total: number };

export type VentesIndex = {
  libelleStatsCampagne: string;
  canManage: boolean;
  canSeeCommercial: boolean;
  aDesAgences: boolean;
  ventes: PageVentes;
};

export async function listerVentes(page = 1) {
  const { props } = await campagnesFetch<VentesIndex>(`/ventes${page > 1 ? `?page=${page}` : ''}`);
  return props;
}

export type OptionsVente = { types_cartes: { id: number; code: string }[]; campagnes_ouvertes: { id: number; nom: string }[]; fiche_adhesion_requise: boolean };

export async function optionsCreationVente() {
  const { props } = await campagnesFetch<OptionsVente>('/ventes/create');
  return props;
}

export type NouvelleVente = {
  prenom: string;
  nom: string;
  telephone?: string;
  ville?: string;
  quartier?: string;
  type_carte_id: number;
  campagne_id?: number;
};

export function creerVente(payload: NouvelleVente, carteIdentite?: File) {
  return campagnesApiFetch<{ success: true; message: string; vente: { id: number; campagne_id: number | null } }>(
    '/api/ventes',
    payload,
    carteIdentite ? { champ: 'carte_identite', valeur: carteIdentite } : undefined,
  );
}

// --- Enrôlements (terrain) --------------------------------------------------------

export type LigneEnrolement = { id: number; date: string; nom: string; numero_compte: string; commercial: string; peut_supprimer: boolean };
export type PageEnrolements = { data: LigneEnrolement[]; current_page: number; last_page: number; per_page: number; total: number };
export type EnrolementsIndex = { libelleStatsCampagne: string; canManage: boolean; enrolements: PageEnrolements };

export async function listerEnrolements(page = 1) {
  const { props } = await campagnesFetch<EnrolementsIndex>(`/enrolements${page > 1 ? `?page=${page}` : ''}`);
  return props;
}

export type NouvelEnrolement = { nom: string; prenom: string; numero_compte: string; telephone?: string; adresse?: string; campagne_id?: number };

export function creerEnrolement(payload: NouvelEnrolement) {
  return campagnesApiFetch<{ success: true; message: string; enrolement: { id: number; campagne_id: number | null } }>(
    '/api/enrolements',
    payload,
  );
}

// --- Campagnes (administration) ---------------------------------------------------

export type StatutCampagne = 'programmee' | 'en_cours' | 'arretee' | 'annulee' | 'terminee';

export type CampagneListe = {
  id: number;
  nom: string;
  type: 'vente_carte' | 'enrolement_app';
  statut: StatutCampagne;
  date_debut: string;
  date_fin: string;
};

export async function listerCampagnesAdmin() {
  const { props } = await campagnesFetch<{ campagnes: CampagneListe[] }>('/admin/campagnes');
  return props.campagnes;
}

export type OptionsCreationCampagne = {
  agences: { id: number; nom: string }[];
  commerciaux: { id: number; nom: string; agence_nom: string }[];
  aDesAgences: boolean;
  clientNom: string;
};

export async function optionsCreationCampagne() {
  const { props } = await campagnesFetch<OptionsCreationCampagne>('/admin/campagnes/create');
  return props;
}

export type NouvelleCampagne = {
  nom: string;
  type: 'vente_carte' | 'enrolement_app';
  date_debut: string;
  date_fin: string;
  toutes_agences?: boolean;
  agence_ids?: number[];
  prime_meilleur_vendeur?: string;
  remise_pourcentage?: string;
  aide_hebdo_active?: boolean;
  aide_hebdo_montant?: string;
};

export async function creerCampagne(payload: NouvelleCampagne) {
  const { props } = await campagnesFetch<{ flash: Flash }>('/admin/campagnes', { method: 'POST', corps: payload });
  return props;
}

export async function modifierCampagne(id: number, payload: Partial<NouvelleCampagne>) {
  const { props } = await campagnesFetch<{ flash: Flash }>(`/admin/campagnes/${id}`, { method: 'PUT', corps: payload });
  return props;
}

export type CampagneDetail = {
  isDirectionDetail: boolean;
  activeTab: string;
  campagne: {
    id: number;
    nom: string;
    type: string;
    statut: StatutCampagne;
    peut_piloter: boolean;
    date_debut: string;
    date_fin: string;
    agences_libelle: string;
    prime_meilleur_vendeur: string | null;
    aide_hebdo_active: boolean;
    aide_hebdo_montant: string | null;
    remise_libelle: string | null;
    created_at: string;
    contrat_publie_at: string | null;
    contrat_articles: { id: number; titre: string; contenu: string }[];
    contrat_reponses: { id: number; user_name: string; statut: string; verrou: boolean; repondu_at: string | null }[];
    aide_versements: { id: number; semaine_debut: string; user_name: string; montant_carburant: string; montant_credit_tel: string; accuse_at: string | null }[];
    actions: { id: number; action: string; description: string; created_at: string; user_name: string }[];
  };
  nbCommerciauxActifs: number;
  nbCommerciauxInactifs: number;
  commerciauxPerimetre: { id: number; nom: string; agence_nom: string; telephone: string; actif: boolean; contrat_statut: string }[];
  stats: { total_ventes: number; par_type: { code: string; nb: number }[]; par_agence: { agence_nom: string; nb: number }[] };
  classement: { rang: number; user_name: string; total_ventes: number }[];
};

export async function obtenirCampagne(id: number, tab?: string) {
  const { props } = await campagnesFetch<CampagneDetail>(`/admin/campagnes/${id}${tab ? `?tab=${tab}` : ''}`);
  return props;
}

/** `description` : motif tracé dans l'historique de la campagne — le backend
 * l'exige (10 caractères minimum), voir `_changer_statut` côté Django. */
export async function arreterCampagne(id: number, description: string) {
  const { props } = await campagnesFetch<{ flash: Flash }>(`/admin/campagnes/${id}/arreter`, {
    method: 'POST',
    corps: { description },
  });
  return props;
}

export async function annulerCampagne(id: number, description: string) {
  const { props } = await campagnesFetch<{ flash: Flash }>(`/admin/campagnes/${id}/annuler`, {
    method: 'POST',
    corps: { description },
  });
  return props;
}

export async function reprogrammerCampagne(id: number, date_debut: string, date_fin: string, description: string) {
  const { props } = await campagnesFetch<{ flash: Flash }>(`/admin/campagnes/${id}/reprogrammer`, {
    method: 'POST',
    corps: { date_debut, date_fin, description },
  });
  return props;
}

// --- Performances ------------------------------------------------------------------

export type LigneClassement = { user_id: number; rang: number; user_name: string; total_ventes: number; pct_volume: number };

export type Performances = {
  libellePeriode: string;
  vueCommerciale: boolean;
  canExport: boolean;
  stats: { total_ventes: number; mes_ventes?: number; mon_rang?: number };
  classement: LigneClassement[];
  classementAgences: { agence_nom: string; total_ventes: number; rang: number; pct_volume: number }[];
  classementTypesCartes: { code: string; total_ventes: number; rang: number; pct_volume: number }[];
  agencesSelect: { id: number; nom: string }[];
  campagnesSelect: { id: number; label: string }[];
};

export async function obtenirPerformances(params: { du?: string; au?: string; agence?: number; campagne_id?: number } = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  const { props } = await campagnesFetch<Performances>(`/performances${q ? `?${q}` : ''}`);
  return props;
}

// --- Mon contrat (commercial) --------------------------------------------------------

export type MonContrat = {
  campagne: { id: number; nom: string } | null;
  document: { articles: { id: number; titre: string; contenu: string }[] } | null;
  statut: 'en_attente' | 'accepte' | 'rejete' | null;
  verrouille: boolean;
  aides: { id: number; semaine_debut: string; montant_carburant: string; montant_credit_tel: string; accuse_at: string | null }[];
};

export async function obtenirMonContrat() {
  const { props } = await campagnesFetch<MonContrat>('/mon-contrat');
  return props;
}

export async function accepterContrat() {
  const { props } = await campagnesFetch<{ flash: Flash }>('/mon-contrat/accepter', { method: 'POST' });
  return props;
}

export async function rejeterContrat() {
  const { props } = await campagnesFetch<{ flash: Flash }>('/mon-contrat/rejeter', { method: 'POST' });
  return props;
}

export async function accuserReceptionAide(id: number) {
  const { props } = await campagnesFetch<{ flash: Flash }>(`/mes-aides/${id}/accuser`, { method: 'POST' });
  return props;
}
