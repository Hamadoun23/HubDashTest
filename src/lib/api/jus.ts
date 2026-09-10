/** Endpoints du module Jus d'orange (`/api/jus/...`) du service `jusorange`.
 * Un seul routeur plat côté serveur : pas de sous-préfixe par rôle, le
 * découpage en écrans (Production/Commercial/Finance/Direction/Reporting)
 * est uniquement une organisation d'écrans côté frontend. Toutes les listes
 * sont paginées par DRF (`{count,next,previous,results}`), voir `listerPage`.
 * Formes de payload d'après une lecture directe du code Django réel (voir
 * rapport d'exploration transmis) — pas des suppositions. */
import { apiFetch, jetonAcces } from './client';

function requete(params: Record<string, string | number | boolean | undefined> = {}) {
  const filtres = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  const chaine = new URLSearchParams(filtres.map(([k, v]) => [k, String(v)])).toString();
  return chaine ? `?${chaine}` : '';
}

export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };

/** Toutes les listes de l'API jus d'orange sont paginées (page_size par défaut
 * 50, max 5000 via `?page_size=`). Comme l'écran n'a pas de composant de
 * pagination, on demande par défaut une page large (200) pour afficher des
 * historiques complets sans construire une UI de pagination dédiée — un
 * appelant peut toujours passer son propre `page_size`/`page`. */
async function listerPage<T>(chemin: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T[]> {
  const donnees = await apiFetch<Page<T>>(`${chemin}${requete({ page_size: 200, ...params })}`);
  return donnees.results;
}

function crud<T, N>(chemin: string) {
  return {
    lister: (params: Record<string, string | number | boolean | undefined> = {}) => listerPage<T>(chemin, params),
    obtenir: (id: number) => apiFetch<T>(`${chemin}${id}/`),
    creer: (payload: N) => apiFetch<T>(chemin, { method: 'POST', corps: payload }),
    modifier: (id: number, payload: Partial<N>) => apiFetch<T>(`${chemin}${id}/`, { method: 'PATCH', corps: payload }),
    remplacer: (id: number, payload: N) => apiFetch<T>(`${chemin}${id}/`, { method: 'PUT', corps: payload }),
    supprimer: (id: number) => apiFetch<void>(`${chemin}${id}/`, { method: 'DELETE' }),
  };
}

// === Options de formulaire ===================================================

export type OptionRef = { value: number; label: string };
export type OptionChoix = { value: string; label: string };
export type OptionCueilletteDisponible = { value: number; label: string; restant: number };

export type OptionsFormulaire = {
  producteurs: OptionRef[];
  producteurs_internes: OptionRef[];
  producteurs_externes: OptionRef[];
  cueillettes_disponibles: OptionCueilletteDisponible[];
  productions_disponibles: OptionRef[];
  articles: OptionRef[];
  articles_actualisables: OptionRef[];
  types_article_creables: OptionChoix[];
  clients: OptionRef[];
  ventes: OptionRef[];
  factures: OptionRef[];
  paiements_sans_reception: OptionRef[];
  utilisateurs: OptionRef[];
  points_vente: OptionRef[];
  statuts_prospection: OptionChoix[];
  types_point_vente: OptionChoix[];
  commerciaux: OptionRef[];
};

export function obtenirOptions(params: { reception?: number; conditionnement?: number } = {}) {
  return apiFetch<OptionsFormulaire>(`/jus/options/${requete(params)}`);
}

// === Production : Producteurs =================================================

export type TypeProd = 'INTERNE' | 'EXTERNE';

export type Producteur = {
  id: number;
  nom_complet: string;
  type_prod: TypeProd;
  type_prod_display: string;
  zone: string;
  contact: string;
  adresse: string;
  actif: boolean;
  date_creation: string;
};

export type NouveauProducteur = {
  nom_complet: string;
  type_prod: TypeProd;
  zone: string;
  contact: string;
  adresse?: string;
  actif?: boolean;
};

const producteursApi = crud<Producteur, NouveauProducteur>('/jus/producteurs/');
export const listerProducteurs = producteursApi.lister;
export const obtenirProducteur = producteursApi.obtenir;
export const creerProducteur = producteursApi.creer;
export const modifierProducteur = producteursApi.modifier;
export const supprimerProducteur = producteursApi.supprimer;

// === Production : Cueillettes ================================================

export type Cueillette = {
  id: number;
  producteur: number;
  producteur_display: string;
  producteur_nom_archive: string;
  date_cueil: string;
  qte_total: number;
  qte_bon: number;
  qte_mauvais: number;
  taux_qualite: number;
  observation: string;
};

export type NouvelleCueillette = {
  producteur: number;
  date_cueil: string;
  qte_total: number;
  qte_bon: number;
  observation?: string;
};

const cueillettesApi = crud<Cueillette, NouvelleCueillette>('/jus/cueillettes/');
export const listerCueillettes = cueillettesApi.lister;
export const obtenirCueillette = cueillettesApi.obtenir;
export const creerCueillette = cueillettesApi.creer;
export const modifierCueillette = cueillettesApi.modifier;
export const supprimerCueillette = cueillettesApi.supprimer;

// === Production : Articles (stock) ===========================================

export type Article = {
  id: number;
  type_art: string;
  type_art_display: string;
  qte_art: number;
  seuil_alerte: number;
  prix_33cl: number | null;
  prix_1l: number | null;
  sous_seuil: boolean;
  actualisable: boolean;
  date_maj: string;
};

export type NouvelArticle = {
  type_art: string;
  seuil_alerte: number;
  prix_33cl?: number;
  prix_1l?: number;
};

const articlesApi = crud<Article, NouvelArticle>('/jus/articles/');
export const listerArticles = articlesApi.lister;
export const obtenirArticle = articlesApi.obtenir;
export const creerArticle = articlesApi.creer;
export const modifierArticle = articlesApi.modifier;
export const supprimerArticle = articlesApi.supprimer;

export function actualiserArticle(id: number, qte_ajout: number) {
  return apiFetch<Article>(`/jus/articles/${id}/actualiser/`, { method: 'POST', corps: { qte_ajout } });
}

// === Production : Réceptions ==================================================

export type EtatQualite = 'EXCELLENT' | 'BON' | 'MAUVAIS';

export type Reception = {
  id: number;
  num_recp: string;
  cueillette: number | null;
  cueillette_display: string;
  producteur_externe: number | null;
  articles: number[];
  date_recp: string;
  qte_recue: number;
  qte_bon: number;
  qte_mauvais: number;
  taux_qualite: number;
  etat_qualite: EtatQualite;
  lieu_depot: string;
  cause_perte: string;
};

export type NouvelleReception = {
  cueillette?: number;
  producteur_externe?: number;
  articles?: number[];
  date_recp: string;
  qte_recue: number;
  qte_bon: number;
  lieu_depot: string;
  cause_perte?: string;
};

const receptionsApi = crud<Reception, NouvelleReception>('/jus/receptions/');
export const listerReceptions = receptionsApi.lister;
export const obtenirReception = receptionsApi.obtenir;
export const creerReception = receptionsApi.creer;
export const modifierReception = receptionsApi.modifier;
export const supprimerReception = receptionsApi.supprimer;

// === Production : Productions (ordres de fabrication) ========================

export type Recette = 'R80_20' | 'R75_25';

export type Production = {
  id: number;
  numero_of: string;
  date_of: string;
  recette: Recette;
  recette_display: string;
  statut: string;
  statut_display: string;
  est_conditionnee: boolean;
  lavage_effectue: boolean | null;
  filtration_effectuee: boolean | null;
  eau_ajoutee_l: number | null;
  sucre_ajoute_kg: number | null;
  sorbate_ajoute_g: number | null;
  pasteurisation_80c: boolean | null;
  test_qualite: boolean | null;
  ph: number | null;
  refractometre: number | null;
  volume_final_l: number | null;
  observation: string;
};

export type NouvelleProduction = { date_of: string; recette: Recette };

const productionsApi = crud<Production, NouvelleProduction>('/jus/productions/');
export const listerProductions = productionsApi.lister;
export const obtenirProduction = productionsApi.obtenir;
export const creerProduction = productionsApi.creer;
export const modifierProduction = productionsApi.modifier;
export const supprimerProduction = productionsApi.supprimer;

export type CompleterProductionPayload = {
  lavage_effectue: boolean;
  filtration_effectuee: boolean;
  eau_ajoutee_l: number;
  sucre_ajoute_kg: number;
  sorbate_ajoute_g: number;
  pasteurisation_80c: boolean;
  test_qualite: boolean;
  ph: number;
  refractometre: number;
  volume_final_l: number;
  observation?: string;
};

export function completerProduction(id: number, payload: CompleterProductionPayload) {
  return apiFetch<Production>(`/jus/productions/${id}/completer/`, { method: 'PATCH', corps: payload });
}

// === Production : Conditionnements ============================================

export type Conditionnement = {
  id: number;
  numero_cond: string;
  production: number;
  production_numero: string;
  date_cond: string;
  qte_33cl: number;
  qte_1l: number;
  volume_utilisee: number;
  observation: string;
  nb_jours: number | null;
  nb_mois: number | null;
  dlc: string;
};

export type NouveauConditionnement = {
  production: number;
  date_cond: string;
  qte_33cl?: number;
  qte_1l?: number;
  volume_utilisee: number;
  observation: string;
  nb_jours?: number;
  nb_mois?: number;
};

const conditionnementsApi = crud<Conditionnement, NouveauConditionnement>('/jus/conditionnements/');
export const listerConditionnements = conditionnementsApi.lister;
export const obtenirConditionnement = conditionnementsApi.obtenir;
export const creerConditionnement = conditionnementsApi.creer;
export const modifierConditionnement = conditionnementsApi.modifier;
export const supprimerConditionnement = conditionnementsApi.supprimer;

// === Production : Bouteilles (créées par les conditionnements) ===============

export type Bouteille = {
  id: number;
  format_display: string;
  statut: string;
  statut_display: string;
  codebar: string;
  dlc: string;
};

const bouteillesApi = crud<Bouteille, Partial<Bouteille>>('/jus/bouteilles/');
export const listerBouteilles = bouteillesApi.lister;
export const obtenirBouteille = bouteillesApi.obtenir;
export const modifierBouteille = bouteillesApi.modifier;
export const supprimerBouteille = bouteillesApi.supprimer;

// === Production : Inventaires =================================================

export type Inventaire = {
  id: number;
  article: number;
  article_display: string;
  date_inv: string;
  qte_depot: number;
  statut: string;
  statut_display: string;
  ecart: number;
  qualite: 'BON' | 'MOYEN' | 'MAUVAIS';
  observation: string;
};

export type NouvelInventaire = {
  article: number;
  date_inv: string;
  qte_depot: number;
  statut?: string;
  observation?: string;
};

const inventairesApi = crud<Inventaire, NouvelInventaire>('/jus/inventaires/');
export const listerInventaires = (params: { article?: number } = {}) => inventairesApi.lister(params);
export const obtenirInventaire = inventairesApi.obtenir;
export const creerInventaire = inventairesApi.creer;
export const supprimerInventaire = inventairesApi.supprimer;

export function ajouterObservationInventaire(id: number, observation: string) {
  return apiFetch<Inventaire>(`/jus/inventaires/${id}/observation/`, { method: 'PATCH', corps: { observation } });
}

// === Commercial : Clients ======================================================

export type Client = {
  id: number;
  nom_complet: string;
  tel_client: string;
  email: string;
  adresse: string;
};

export type NouveauClient = { nom_complet: string; tel_client?: string; email?: string; adresse?: string };

const clientsApi = crud<Client, NouveauClient>('/jus/clients/');
export const listerClients = clientsApi.lister;
export const obtenirClient = clientsApi.obtenir;
export const creerClient = clientsApi.creer;
export const modifierClient = clientsApi.modifier;
export const supprimerClient = clientsApi.supprimer;

// === Commercial : Ventes =======================================================

export type StatutPaiement = 'DEPOT_VENTE' | 'PARTIELLE' | 'ACHAT_VENTE';

export type Vente = {
  id: number;
  client: number;
  client_nom: string;
  date_vente: string;
  montant_total: number;
  statut_paiement: StatutPaiement;
  statut_display: string;
  total_paye: number;
  reste_a_payer: number;
};

export type NouvelleVente = {
  client: number;
  date_vente: string;
  montant_total: number;
  statut_paiement: StatutPaiement;
};

const ventesApi = crud<Vente, NouvelleVente>('/jus/ventes/');
export const listerVentes = ventesApi.lister;
export const obtenirVente = ventesApi.obtenir;
export const creerVente = ventesApi.creer;
export const modifierVente = ventesApi.modifier;
export const supprimerVente = ventesApi.supprimer;

export type VenteDetail = { vente: Vente; commandes: Commande[]; factures: Facture[] };

export function obtenirDetailVente(id: number) {
  return apiFetch<VenteDetail>(`/jus/ventes/${id}/detail/`);
}

// === Commercial : Commandes ====================================================

export type Commande = {
  id: number;
  client: number;
  client_nom: string;
  date_cmd: string;
  quantite_33cl: number;
  quantite_1l: number;
  total: number;
  est_completee: boolean;
  vente: number | null;
};

export type NouvelleCommande = {
  client: number;
  date_cmd?: string;
  quantite_33cl?: number;
  quantite_1l?: number;
};

const commandesApi = crud<Commande, NouvelleCommande>('/jus/commandes/');
export const listerCommandes = commandesApi.lister;
export const obtenirCommande = commandesApi.obtenir;
export const creerCommande = commandesApi.creer;
export const modifierCommande = commandesApi.modifier;
export const supprimerCommande = commandesApi.supprimer;

export type CompleterCommandePayload = { statut_paiement: StatutPaiement; montant_paye?: number };
export type ResultatCompletionCommande = { detail: string; vente: Vente; facture: Facture };

export function completerCommande(id: number, payload: CompleterCommandePayload) {
  return apiFetch<ResultatCompletionCommande>(`/jus/commandes/${id}/completer/`, { method: 'POST', corps: payload });
}

// === Commercial : Factures ======================================================

export type Recouvrement = { statut: string; libelle: string; action: string; jours: number; montant_attendu: number };

export type Facture = {
  id: number;
  num_fact: string;
  vente: number;
  client_nom: string;
  date_fact: string;
  montant: number;
  statut: string;
  statut_display: string;
  date_echeance: string;
  total_paye: number;
  reste_a_payer: number;
  jours_avant_echeance: number;
  recouvrement: Recouvrement;
};

export type FactureDetail = Facture & {
  paiements: Paiement[];
  vente_id: number;
  client_tel: string;
  client_email: string;
};

export type NouvelleFacture = {
  vente: number;
  date_fact: string;
  montant: number;
  statut?: string;
  date_echeance: string;
};

const facturesApi = crud<Facture, NouvelleFacture>('/jus/factures/');
export const listerFactures = facturesApi.lister;
export const creerFacture = facturesApi.creer;
export const modifierFacture = facturesApi.modifier;
export const supprimerFacture = facturesApi.supprimer;

export function obtenirFacture(id: number) {
  return apiFetch<FactureDetail>(`/jus/factures/${id}/`);
}

export type ModePaie = 'ESPECE' | 'CHEQUE' | 'VIREMENT' | 'MOBILE';

export type PaiementFacturePayload = { date_paie: string; montant: number; mode_paie: ModePaie; reference?: string };
export type ResultatPaiementFacture = { detail: string; facture: FactureDetail };

export function payerFacture(id: number, payload: PaiementFacturePayload) {
  return apiFetch<ResultatPaiementFacture>(`/jus/factures/${id}/paiement/`, { method: 'POST', corps: payload });
}

// === Commercial : Paiements =====================================================

export type Paiement = {
  id: number;
  facture: number;
  num_fact: string;
  date_paie: string;
  montant: number;
  mode_paie: ModePaie;
  mode_display: string;
  reference: string;
};

export type NouveauPaiement = { facture: number; date_paie: string; montant: number; mode_paie: ModePaie; reference?: string };

const paiementsApi = crud<Paiement, NouveauPaiement>('/jus/paiements/');
export const listerPaiements = paiementsApi.lister;
export const obtenirPaiement = paiementsApi.obtenir;
export const creerPaiement = paiementsApi.creer;
export const modifierPaiement = paiementsApi.modifier;
export const supprimerPaiement = paiementsApi.supprimer;

// === Commercial : Prospection (points de vente + visites) ======================

export type TypePointVente =
  | 'BOUTIQUE'
  | 'SUPERMARCHE'
  | 'EPICERIE'
  | 'RESTAURANT'
  | 'HOTEL'
  | 'KIOSQUE'
  | 'STATION'
  | 'GROSSISTE'
  | 'ENTREPRISE'
  | 'AUTRE';

export type StatutProspection = 'PROSPECTE' | 'INTERESSE' | 'CLIENT' | 'PARTENAIRE' | 'A_RELANCER' | 'REFUS';

export type PointVente = {
  id: number;
  nom: string;
  type_point: TypePointVente;
  type_display: string;
  couleur: string;
  latitude: number;
  longitude: number;
  adresse: string;
  contact_nom: string;
  contact_tel: string;
  contact_email: string;
  statut: StatutProspection;
  statut_display: string;
  relance_en_retard: boolean;
  potentiel_ca: number | null;
  date_prochaine_relance: string | null;
  commercial: number | null;
  commercial_nom: string;
  client_nom: string;
  nb_visites: number;
  derniere_visite: string | null;
  photo_url: string | null;
};

export type PointVenteDetail = PointVente & { visites: Visite[] };

export type NouveauPointVente = {
  nom: string;
  type_point: TypePointVente;
  latitude: number;
  longitude: number;
  adresse?: string;
  contact_nom?: string;
  contact_tel?: string;
  contact_email?: string;
  statut?: StatutProspection;
  potentiel_ca?: number;
  date_prochaine_relance?: string;
  commercial?: number;
};

const pointsVenteApi = crud<PointVente, NouveauPointVente>('/jus/points-vente/');
export const listerPointsVente = (params: { statut?: string; commercial?: number; relances?: 0 | 1 } = {}) =>
  pointsVenteApi.lister(params);
export const creerPointVente = pointsVenteApi.creer;
export const modifierPointVente = pointsVenteApi.modifier;
export const supprimerPointVente = pointsVenteApi.supprimer;

export function obtenirPointVente(id: number) {
  return apiFetch<PointVenteDetail>(`/jus/points-vente/${id}/`);
}

export type ConversionClientPayload = { nom_complet?: string; tel_client?: string; email?: string; adresse?: string };
export type ResultatConversion = { detail: string; point_vente: PointVente };

export function convertirClient(id: number, payload: ConversionClientPayload) {
  return apiFetch<ResultatConversion>(`/jus/points-vente/${id}/convertir_client/`, { method: 'POST', corps: payload });
}

export type Visite = {
  id: number;
  point_vente: number;
  commercial: number | null;
  date_visite: string;
  statut_constate: string;
  compte_rendu: string;
  photo: string | null;
  latitude: number | null;
  longitude: number | null;
  date_prochaine_relance: string | null;
};

export function listerVisites(params: { point_vente?: number } = {}) {
  return listerPage<Visite>('/jus/visites/', params);
}

/** `payload` peut contenir un fichier (`photo`) : dans ce cas on envoie un
 * `FormData` (voir `identity.ts` / `changerPhoto` pour le même principe) —
 * `apiFetch` détecte `corps instanceof FormData` et ne fixe pas Content-Type. */
export function creerVisite(payload: {
  point_vente: number;
  commercial?: number;
  date_visite?: string;
  statut_constate?: string;
  compte_rendu?: string;
  photo?: File;
  latitude?: number;
  longitude?: number;
  date_prochaine_relance?: string;
}) {
  const { photo, ...reste } = payload;
  if (!photo) {
    return apiFetch<Visite>('/jus/visites/', { method: 'POST', corps: reste });
  }
  const corps = new FormData();
  Object.entries(reste).forEach(([cle, valeur]) => {
    if (valeur !== undefined) corps.append(cle, String(valeur));
  });
  corps.append('photo', photo);
  return apiFetch<Visite>('/jus/visites/', { method: 'POST', corps });
}

// === Finance : Trésorerie =======================================================

export type StatutReception = 'CONFORME' | 'ECART_POSITIF' | 'ECART_NEGATIF';

export type Tresorerie = {
  id: number;
  paiement: number;
  num_fact: string;
  montant_declare: number;
  montant_recu: number;
  date_reception: string;
  client_nom: string;
  ecart: number;
  statut_reception: StatutReception;
  ecart_traite: boolean;
  observation: string;
};

export type NouvelleTresorerie = { paiement: number; montant_recu: number; date_reception: string; observation?: string };

const tresorerieApi = crud<Tresorerie, NouvelleTresorerie>('/jus/tresorerie/');
export const listerTresorerie = tresorerieApi.lister;
export const obtenirTresorerie = tresorerieApi.obtenir;
export const creerTresorerie = tresorerieApi.creer;
export const supprimerTresorerie = tresorerieApi.supprimer;

export type LigneRapprochement = {
  paiement_id: number;
  date_paie: string;
  num_fact: string;
  client_nom: string;
  mode_paie: string;
  mode_display: string;
  montant_commercial: number;
  reception_id: number | null;
  montant_recu: number | null;
  date_reception: string | null;
  ecart: number | null;
  statut_reception: StatutReception | 'EN_ATTENTE';
  ecart_traite: boolean;
  observation: string;
};

export type Rapprochement = {
  lignes: LigneRapprochement[];
  totaux: {
    total_commercial: number;
    total_recu: number;
    ecart_global: number;
    nb_en_attente: number;
    nb_ecarts_non_traites: number;
  };
};

export function obtenirRapprochement() {
  return apiFetch<Rapprochement>('/jus/tresorerie/rapprochement/');
}

export function gererEcartTresorerie(id: number, observation: string) {
  return apiFetch<Tresorerie>(`/jus/tresorerie/${id}/gerer-ecart/`, { method: 'PATCH', corps: { observation } });
}

// === Direction : Utilisateurs ====================================================

export type RoleJus = 'ResProd' | 'Commercial' | 'Finance' | 'Direction';

export type UtilisateurJus = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  roles: string[];
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
};

export type NouvelUtilisateurJus = {
  username: string;
  email?: string;
  is_active?: boolean;
  password: string;
  role?: RoleJus;
};

const utilisateursJusApi = crud<UtilisateurJus, NouvelUtilisateurJus>('/jus/utilisateurs/');
export const listerUtilisateursJus = utilisateursJusApi.lister;
export const obtenirUtilisateurJus = utilisateursJusApi.obtenir;
export const creerUtilisateurJus = utilisateursJusApi.creer;
export const modifierUtilisateurJus = utilisateursJusApi.modifier;
export const supprimerUtilisateurJus = utilisateursJusApi.supprimer;

// === Reporting ====================================================================

export type KpiSummary = {
  kpi: {
    recolte_total: number;
    jus_stock: number;
    ca_total: number;
    bouteilles: number;
    articles_sous_seuil: number;
    clients: number;
    ventes: number;
    productions: number;
  };
  recolte_zone: { zone: string; tonnage: number }[];
  stock_articles: { article: string; stock: number; seuil: number }[];
  paiements_mode: { mode_paie: string; total: number }[];
};

export function obtenirSummary() {
  return apiFetch<KpiSummary>('/jus/reporting/summary/');
}

export type ModuleReporting = 'recolte' | 'appro' | 'fabrication' | 'emballage' | 'entrepot' | 'distribution';

/** La forme du reste de la réponse est libre selon le module (voir rapport
 * d'exploration) : on ne type que la période commune, le reste est affiché
 * de façon générique par l'écran de reporting (voir `composants.tsx`). */
export type RapportModule = {
  periode: { date_debut: string; date_fin: string };
  [cle: string]: unknown;
};

export function obtenirRapport(module: ModuleReporting, params: { periode?: 'semaine' | 'mois' | 'trimestre'; date_debut?: string; date_fin?: string } = {}) {
  return apiFetch<RapportModule>(`/jus/reporting/${module}/${requete(params)}`);
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

/** Récupère le fichier Excel d'un rapport et déclenche son téléchargement.
 * `apiFetch` parse toujours du JSON, inadapté à un fichier binaire : on fait
 * donc un `fetch` direct avec le jeton d'accès courant, puis on convertit la
 * réponse en blob et on simule un clic sur un lien temporaire. */
export async function exporterRapport(
  module: ModuleReporting,
  params: { periode?: 'semaine' | 'mois' | 'trimestre'; date_debut?: string; date_fin?: string } = {},
): Promise<void> {
  const entetes: Record<string, string> = {};
  if (jetonAcces()) entetes.Authorization = `Bearer ${jetonAcces()}`;

  const reponse = await fetch(`${BASE_URL}/jus/reporting/${module}/export/${requete(params)}`, { headers: entetes });
  if (!reponse.ok) throw new Error(`Échec de l'export (${reponse.status})`);

  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `rapport-${module}.xlsx`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
