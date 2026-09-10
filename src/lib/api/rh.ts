/** Endpoints du module RH (`/api/rh/...` + `/api/utilisateurs/`, `/api/departements/`)
 * du service `financerh`. Formes de payload d'après le code réel de
 * `backend/financerh` (voir rapport d'exploration). */
import { apiFetch } from './client';
import type { Utilisateur } from './auth';

export type { Utilisateur };

function requete(params: Record<string, string | number | boolean | undefined>) {
  const filtres = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  const chaine = new URLSearchParams(filtres.map(([k, v]) => [k, String(v)])).toString();
  return chaine ? `?${chaine}` : '';
}

// --- Annuaire / organisation -----------------------------------------------

export function listerUtilisateurs(params: { departement?: number; role?: string; is_active?: boolean; recherche?: string } = {}) {
  const { recherche, ...reste } = params;
  return apiFetch<{ results: Utilisateur[] } | Utilisateur[]>(
    `/utilisateurs/${requete({ ...reste, search: recherche })}`,
  );
}

export function obtenirMonEquipe() {
  return apiFetch<Utilisateur[]>('/utilisateurs/mon-equipe/');
}

export type Departement = { id: number; code: string; nom: string; responsable: number | null; responsable_nom: string; effectif: number };

export function listerDepartements() {
  return apiFetch<{ results: Departement[] } | Departement[]>('/departements/');
}

// --- Demandes d'absence (congés, retards, permissions) ----------------------

export type StatutDemande = 'BROUILLON' | 'EN_VALIDATION' | 'APPROUVE' | 'REJETE' | 'CLOTURE' | 'ANNULE';

export type EtapeValidation = {
  id: number;
  ordre: number;
  libelle: string;
  role_valideur: string;
  role_valideur_libelle: string;
  valideur_attendu: number | null;
  valideur_attendu_nom: string;
  nature: 'AVIS' | 'DECISION' | 'INFORMATION';
  decision: 'EN_ATTENTE' | 'APPROUVE' | 'REJETE' | 'VU';
  decision_libelle: string;
  decide_par: number | null;
  decide_par_nom: string;
  date_decision: string | null;
  commentaire: string;
};

export type DemandeAbsence = {
  id: number;
  numero: string;
  demandeur: number;
  demandeur_nom: string;
  demandeur_departement: number | null;
  demandeur_departement_nom: string;
  type_absence: number;
  type_absence_libelle: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  demi_journee: boolean;
  heure_debut: string | null;
  heure_fin: string | null;
  nb_jours: string;
  motif: string;
  justificatif: string | null;
  remplacant: number | null;
  remplacant_nom: string;
  statut: StatutDemande;
  statut_libelle: string;
  motif_rejet: string;
  date_soumission: string | null;
  etape_courante_libelle: string;
  etapes: EtapeValidation[];
  modifiable: boolean;
  verrou_motif: string;
  cree_le: string;
};

export type NouvelleDemandeAbsence = {
  type_absence: string; // libellé libre — voir rapport : pas un id
  date_debut: string;
  date_fin: string;
  demi_journee?: boolean;
  heure_debut?: string | null;
  heure_fin?: string | null;
  motif: string;
  remplacant?: number | null;
};

function listeOuResultats<T>(donnees: { results: T[] } | T[]): T[] {
  return Array.isArray(donnees) ? donnees : donnees.results;
}

export async function listerDemandesAbsence(params: { statut?: StatutDemande; categorie?: string } = {}) {
  const donnees = await apiFetch<{ results: DemandeAbsence[] } | DemandeAbsence[]>(
    `/rh/demandes-absence/${requete(params)}`,
  );
  return listeOuResultats(donnees);
}

export async function mesDemandes() {
  const donnees = await apiFetch<{ results: DemandeAbsence[] } | DemandeAbsence[]>('/rh/demandes-absence/mes-demandes/');
  return listeOuResultats(donnees);
}

export async function demandesAValider() {
  const donnees = await apiFetch<{ results: DemandeAbsence[] } | DemandeAbsence[]>('/rh/demandes-absence/a-valider/');
  return listeOuResultats(donnees);
}

export function creerDemandeAbsence(payload: NouvelleDemandeAbsence) {
  return apiFetch<DemandeAbsence>('/rh/demandes-absence/', { method: 'POST', corps: payload });
}

export function modifierDemandeAbsence(id: number, payload: Partial<NouvelleDemandeAbsence>) {
  return apiFetch<DemandeAbsence>(`/rh/demandes-absence/${id}/`, { method: 'PATCH', corps: payload });
}

export function supprimerDemandeAbsence(id: number) {
  return apiFetch<void>(`/rh/demandes-absence/${id}/`, { method: 'DELETE' });
}

export function soumettreDemande(id: number) {
  return apiFetch<DemandeAbsence>(`/rh/demandes-absence/${id}/soumettre/`, { method: 'POST' });
}

export function validerDemande(id: number, commentaire = '') {
  return apiFetch<DemandeAbsence>(`/rh/demandes-absence/${id}/valider/`, { method: 'POST', corps: { commentaire } });
}

export function rejeterDemande(id: number, commentaire: string) {
  return apiFetch<DemandeAbsence>(`/rh/demandes-absence/${id}/rejeter/`, { method: 'POST', corps: { commentaire } });
}

export function annulerDemande(id: number) {
  return apiFetch<DemandeAbsence>(`/rh/demandes-absence/${id}/annuler/`, { method: 'POST' });
}

export type TypeAbsence = {
  id: number;
  code: string;
  libelle: string;
  categorie: string;
  decompte_solde: boolean;
  duree_max_jours: number | null;
  justificatif_requis: boolean;
  actif: boolean;
};

export async function listerTypesAbsence() {
  const donnees = await apiFetch<{ results: TypeAbsence[] } | TypeAbsence[]>('/rh/types-absence/');
  return listeOuResultats(donnees);
}

export type SoldeConges = { id: number; agent: number; agent_nom: string; annee: number; jours_acquis: number; jours_reportes: number; jours_pris: number; jours_restants: number };

export function monSolde(annee: number) {
  return apiFetch<SoldeConges>(`/rh/soldes-conges/mon-solde/?annee=${annee}`);
}

// --- Présences / pointage ----------------------------------------------------

export type Presence = {
  id: number;
  agent: number;
  agent_nom: string;
  date: string;
  heure_arrivee: string | null;
  heure_depart: string | null;
  statut: 'PRESENT' | 'RETARD' | 'ABSENT' | 'CONGE' | 'MISSION' | 'TELETRAVAIL' | 'REPOS';
  statut_libelle: string;
  heures_travaillees: number | null;
  retard_minutes: number;
  commentaire: string;
};

export async function listerPresences(params: { agent?: number; date?: string; statut?: string } = {}) {
  const donnees = await apiFetch<{ results: Presence[] } | Presence[]>(`/rh/presences/${requete(params)}`);
  return listeOuResultats(donnees);
}

export function pointerArrivee(heure?: string, commentaire = '') {
  return apiFetch<Presence>('/rh/presences/pointer-arrivee/', { method: 'POST', corps: { heure, commentaire } });
}

export function pointerDepart(heure?: string, commentaire = '') {
  return apiFetch<Presence>('/rh/presences/pointer-depart/', { method: 'POST', corps: { heure, commentaire } });
}

// --- Indicateurs (RH/Direction) ---------------------------------------------

export type Indicateurs = {
  annee: number;
  effectif: { actuel: number; entrees: number; sorties: number; par_departement: { departement: string; effectif: number }[]; par_contrat: { type_contrat: string; effectif: number }[] };
  turnover: { taux_pourcent: number; effectif_moyen: number; motifs: { motif: string; total: number }[] };
  absenteisme: { taux_pourcent: number; jours_absence: number; jours_retard: number; minutes_retard_cumulees: number };
  demandes: { total: number; en_validation: number; approuvees: number; rejetees: number; par_categorie: { categorie: string; total: number }[] };
  performance: { note_moyenne: number | null; evaluations_validees: number };
  formations: { planifiees: number; inscrits: number };
};

export function obtenirIndicateurs(annee: number) {
  return apiFetch<Indicateurs>(`/rh/indicateurs/?annee=${annee}`);
}
