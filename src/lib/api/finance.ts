/** Endpoints du module Finance (`/api/finance/...`) du service `financerh`.
 * Formes de payload d'après `backend/financerh/finance/serializers.py`. */
import { apiFetch } from './client';
import { listerDepartements as listerDepartementsRh } from './rh';
import type { EtapeValidation, StatutDemande } from './rh';
export type { Departement } from './rh';

function requete(params: Record<string, string | number | boolean | undefined>) {
  const filtres = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  const chaine = new URLSearchParams(filtres.map(([k, v]) => [k, String(v)])).toString();
  return chaine ? `?${chaine}` : '';
}

function listeOuResultats<T>(donnees: { results: T[] } | T[]): T[] {
  return Array.isArray(donnees) ? donnees : donnees.results;
}

// --- Réquisitions -------------------------------------------------------

export type Priorite = 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE';

export type LigneRequisition = {
  id?: number;
  designation: string;
  quantite: string | number;
  unite?: string;
  prix_unitaire: string | number;
  montant?: string;
};

export type Requisition = {
  id: number;
  numero: string;
  demandeur: number;
  demandeur_nom: string;
  demandeur_departement: number | null;
  demandeur_departement_nom: string;
  objet: string;
  departement: number | null;
  departement_nom: string;
  justification: string;
  date_besoin: string | null;
  priorite: Priorite;
  priorite_libelle: string;
  montant: string;
  montant_estime: boolean;
  lignes: LigneRequisition[];
  statut: StatutDemande;
  statut_libelle: string;
  motif_rejet: string;
  date_soumission: string | null;
  etape_courante_libelle: string;
  etapes: EtapeValidation[];
  modifiable: boolean;
  verrou_motif: string;
  devise: string;
  cree_le: string;
};

export type NouvelleRequisition = {
  objet: string;
  departement?: number | null;
  justification?: string;
  date_besoin?: string | null;
  priorite?: Priorite;
  montant_estime?: boolean;
  lignes: LigneRequisition[];
};

export async function mesRequisitions() {
  const donnees = await apiFetch<{ results: Requisition[] } | Requisition[]>(
    '/finance/requisitions/mes-demandes/',
  );
  return listeOuResultats(donnees);
}

export async function requisitionsAValider() {
  const donnees = await apiFetch<{ results: Requisition[] } | Requisition[]>(
    '/finance/requisitions/a-valider/',
  );
  return listeOuResultats(donnees);
}

export async function listerRequisitions(params: { statut?: StatutDemande; priorite?: Priorite } = {}) {
  const donnees = await apiFetch<{ results: Requisition[] } | Requisition[]>(
    `/finance/requisitions/${requete(params)}`,
  );
  return listeOuResultats(donnees);
}

export function obtenirRequisition(id: number) {
  return apiFetch<Requisition>(`/finance/requisitions/${id}/`);
}

export function creerRequisition(payload: NouvelleRequisition) {
  return apiFetch<Requisition>('/finance/requisitions/', { method: 'POST', corps: payload });
}

export function modifierRequisition(id: number, payload: Partial<NouvelleRequisition>) {
  return apiFetch<Requisition>(`/finance/requisitions/${id}/`, { method: 'PATCH', corps: payload });
}

export function supprimerRequisition(id: number) {
  return apiFetch<void>(`/finance/requisitions/${id}/`, { method: 'DELETE' });
}

export function soumettreRequisition(id: number) {
  return apiFetch<Requisition>(`/finance/requisitions/${id}/soumettre/`, { method: 'POST' });
}

export function validerRequisition(id: number, commentaire = '') {
  return apiFetch<Requisition>(`/finance/requisitions/${id}/valider/`, { method: 'POST', corps: { commentaire } });
}

export function rejeterRequisition(id: number, commentaire: string) {
  return apiFetch<Requisition>(`/finance/requisitions/${id}/rejeter/`, { method: 'POST', corps: { commentaire } });
}

export function annulerRequisition(id: number) {
  return apiFetch<Requisition>(`/finance/requisitions/${id}/annuler/`, { method: 'POST' });
}

// --- Départements (référentiel partagé avec le module RH) ---------------

export async function listerDepartements() {
  const donnees = await listerDepartementsRh();
  return listeOuResultats(donnees);
}
