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

/** Un admin/direction qui pilote plusieurs clients de GDA (BDM, UBA...) et n'a
 * pas encore choisi lequel il consulte est redirigé côté serveur vers
 * `Partenaires/Choix` plutôt que de recevoir un tableau de bord — voir
 * `core/views.py::choix_client` et `core/middleware.py` (middleware qui force
 * ce choix). `campagnesFetch` suit cette redirection sans le signaler : c'est
 * le `component` de la réponse, pas son statut HTTP, qui le révèle. */
export type Dashboard = DashboardAdmin | DashboardCommercial | DashboardTelephonique | { variant: 'choix_client' };

export async function obtenirTableauDeBord() {
  const reponse = await campagnesFetch<Dashboard>('/dashboard');
  if (reponse.component === 'Partenaires/Choix') {
    return { variant: 'choix_client' } as const;
  }
  return reponse.props;
}

// --- Choix du partenaire (admin / direction) --------------------------------------

export type PartenaireChoix = {
  id: number;
  code: string;
  nom: string;
  nom_complet: string | null;
  organisation: 'agences' | 'commerciaux';
  campagnes_actives: number;
  commerciaux: number;
  agences: number;
};

export type OptionsChoixClient = { partenaires: PartenaireChoix[]; courantId: number | null };

export async function obtenirChoixClient() {
  const { props } = await campagnesFetch<OptionsChoixClient>('/choix-client');
  return props;
}

export async function choisirPartenaire(id: number) {
  const { props } = await campagnesFetch<{ errors?: Record<string, string>; flash?: Flash }>('/choix-client', {
    method: 'POST',
    corps: { partenaire_id: id },
  });
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

/** Formes exactes des props Inertia de `Ventes/Create` — voir
 * `backend/campagnes/terrain/views.py::ventes_create`. Le service renvoie ici
 * des clés camelCase (contrairement à `ventes_index`/`VentesIndex`, qui sont
 * en snake_case) : chaque vue Django choisit ses propres clés, aucune
 * convention globale ne les uniformise. */
export type OptionsVente = {
  typesCartes: { id: number; code: string }[];
  campagnesOuvertes: { id: number; nom: string; date_fin: string }[];
  peutVendre: boolean;
  contratAccepte: boolean;
  /** Vrai pour un partenaire (ex. UBA) qui exige la demande d'adhésion carte
   * prépayée en plus de la vente — voir la section adhésion du formulaire. */
  ficheAdhesion: boolean;
  clientNom: string | null;
  typesPiece: { valeur: string; libelle: string }[];
};

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
  // Champs de la demande d'adhésion — envoyés seulement si `ficheAdhesion` est vrai.
  nom_sur_carte?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  nationalite?: string;
  email?: string;
  adresse?: string;
  pays_residence?: string;
  piece_type?: string;
  piece_numero?: string;
  piece_delivree_le?: string;
  piece_expire_le?: string;
  piece_autorite?: string;
  numero_compte_uba?: string;
  profession?: string;
  employeur?: string;
};

export function creerVente(payload: NouvelleVente, carteIdentite?: File) {
  return campagnesApiFetch<{ success: true; message: string; vente: { id: number; campagne_id: number | null } }>(
    '/api/ventes',
    payload,
    carteIdentite ? { champ: 'carte_identite', valeur: carteIdentite } : undefined,
  );
}

// --- Enrôlements (terrain) --------------------------------------------------------

/** Voir `terrain/views.py::enrolements_index` — pas de `libelleStatsCampagne`
 * ici (contrairement à `ventes_index`) : cet écran n'affiche pas ce résumé. */
export type LigneEnrolement = {
  id: number;
  date: string;
  client_nom: string;
  numero_compte: string;
  telephone: string | null;
  adresse: string | null;
  commercial: string;
  agence: string;
  peut_supprimer: boolean;
};
export type PageEnrolements = { data: LigneEnrolement[]; current_page: number; last_page: number; per_page: number; total: number };
export type EnrolementsIndex = { canManage: boolean; canSeeCommercial: boolean; aDesAgences: boolean; enrolements: PageEnrolements };

export async function listerEnrolements(page = 1) {
  const { props } = await campagnesFetch<EnrolementsIndex>(`/enrolements${page > 1 ? `?page=${page}` : ''}`);
  return props;
}

/** Props exactes de `Enrolements/Create` — voir `terrain/views.py::enrolements_create`. */
export type OptionsEnrolement = {
  campagnesOuvertes: { id: number; nom: string; date_fin: string }[];
  peutEnroler: boolean;
  contratAccepte: boolean;
};

export async function optionsCreationEnrolement() {
  const { props } = await campagnesFetch<OptionsEnrolement>('/enrolements/create');
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

/** Props exactes de `Commercial/Contrat/Show` — voir
 * `terrain/views.py::contrat_show`. Transcription fidèle du contrat de
 * prestation légal (préambule, rémunération, clauses) : voir
 * `Bdm-main/frontend/src/Pages/Commercial/Contrat/ContratDocument.jsx`,
 * texte à ne jamais reformuler. Quand `campagne` est `null`, le commercial
 * n'a pas de campagne qui le concerne (voir `Commercial/Contrat/NoCampagne`). */
export type ContratCampagne = {
  nom: string;
  date_debut: string;
  date_fin: string;
  contrat_publie_at: boolean;
  aide_hebdo_active: boolean;
};

export type ContratDocumentTexte = {
  /** Vrai pour les partenaires (ex. UBA) dont les articles énoncent déjà la
   * rémunération — le bloc "Rémunération, forfaits et aides" est alors omis. */
  remuneration_dans_articles: boolean;
  client_nom: string | null;
  representant_nom: string;
  nom_presta: string;
  contact_presta: string;
  adresse: string;
  piece_id: string;
  lundi_effectif: string;
  date_fin: string;
  nom_campagne: string;
  articles: { titre: string; contenu: string }[];
  emolument_forfait: string;
  forfait_communication: string;
  forfait_deplacement: string;
  prime_meilleur_vendeur: string;
  aide_hebdo_active: boolean;
  aide_hebdo_montant: string;
  aide_hebdo_carburant: string;
  aide_hebdo_credit_tel: string;
  clause_libre: string | null;
  lieu_signature: string;
  date_signature_affichee: string;
};

export type VersementAide = {
  id: number;
  semaine_debut: string;
  montant_carburant: string;
  montant_credit_tel: string;
  accuse_at: string | null;
};

export type MonContrat = {
  campagne: ContratCampagne | null;
  user: { adresse_contrat: string | null; piece_identite_ref: string | null };
  reponse: { statut: 'en_attente' | 'accepte' | 'rejete'; repondu_at: string | null };
  /** Vrai : délai de 5 jours après publication dépassé, réponse verrouillée. */
  verrou5j: boolean;
  peutRepondre: boolean;
  echeance: string | null;
  document: ContratDocumentTexte;
  versements: VersementAide[];
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

export async function accuserReceptionAide(id: number, commentaire?: string) {
  const { props } = await campagnesFetch<{ flash: Flash }>(`/mes-aides/${id}/accuser`, {
    method: 'POST',
    corps: { accuse_commentaire: commentaire || undefined },
  });
  return props;
}

// --- Reporting téléphonique (commercial téléphonique) ------------------------------

export type LigneTelephonique = {
  id: number;
  date_iso: string;
  date: string;
  appels_emis: number;
  appels_joignables: number;
  appels_non_joignables: number;
  taux_joignabilite: string | null;
  clients_interesses_nombre: number;
  peut_modifier: boolean;
};

export type TotauxTelephonique = {
  nb_fiches: number;
  appels_emis: number;
  appels_joignables: number;
  appels_non_joignables: number;
  clients_interesses: number;
} | null;

export type TelephoniqueIndex = {
  libelleStatsCampagne: string;
  totauxListe: TotauxTelephonique;
  rapports: { data: LigneTelephonique[]; current_page: number; last_page: number; per_page: number; total: number };
};

export async function listerTelephonique(page = 1) {
  const { props } = await campagnesFetch<TelephoniqueIndex>(`/reporting-telephonique${page > 1 ? `?page=${page}` : ''}`);
  return props;
}

export type RapportTelephoniqueExistant = {
  appels_emis: number;
  appels_joignables: number;
  taux_joignabilite: number | null;
  clients_interesses_nombre: number;
  clients_deja_servis_nombre: number;
  nj_repondeur: number;
  nj_numero_errone: number;
  nj_hors_reseau: number;
  nj_autres_nombre: number;
  nj_autres_precision: string | null;
  propose: Record<string, number>;
};

/** Props exactes de `Commercial/Telephonique/Form` — voir
 * `terrain/views.py::telephonique_create`. Une fiche par jour : `rapport` est
 * la fiche déjà saisie pour `dateRapport`, `null` si le jour est vierge. */
export type OptionsTelephonique = {
  dateRapport: string;
  campagneActiveNom: string | null;
  rapportVerrouille: boolean;
  typesCampagne: { id: number; code: string }[];
  rapport: RapportTelephoniqueExistant | null;
};

export async function optionsTelephonique(dateIso?: string) {
  const { props } = await campagnesFetch<OptionsTelephonique>(`/reporting-telephonique/saisie${dateIso ? `?date=${dateIso}` : ''}`);
  return props;
}

export type NouveauRapportTelephonique = {
  date_rapport: string;
  appels_emis: number;
  appels_joignables: number;
  clients_interesses_nombre: number;
  clients_deja_servis_nombre: number;
  propose: Record<string, number>;
  nj_repondeur: number;
  nj_numero_errone: number;
  nj_hors_reseau: number;
  nj_autres_nombre: number;
  nj_autres_precision?: string;
};

/** Écriture Inertia classique (`POST /reporting-telephonique`, pas un
 * endpoint `/api/...` JSON) : en cas d'erreur de validation, Django
 * redirige via `HTTP_REFERER` (voir `core.middleware.retour_avec_erreurs`)
 * — un en-tête que ce client envoie, mais qui pointe ici vers l'URL du hub,
 * pas vers une page du service campagnes ; la redirection ne reviendra donc
 * pas correctement tant que ce n'est pas adapté côté backend. Le contrat
 * décrit ci-dessous (`props.errors`, partagé par le middleware Inertia sur
 * toute réponse) est le bon côté front, prêt dès que ce sera corrigé. */
export async function enregistrerRapportTelephonique(payload: NouveauRapportTelephonique) {
  const { props } = await campagnesFetch<{ errors?: Record<string, string> }>('/reporting-telephonique', {
    method: 'POST',
    corps: payload,
  });
  return props;
}

export async function supprimerRapportTelephonique(id: number) {
  const { props } = await campagnesFetch<{ flash: Flash }>(`/reporting-telephonique/${id}`, { method: 'DELETE' });
  return props;
}
