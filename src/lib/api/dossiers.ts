import { apiFetch } from './client';

/**
 * Détail d'un dossier soumis à validation (absence, réquisition, dépense…),
 * avec son fil d'échanges, sa mise en attente et ses versions — mêmes routes
 * pour tous les types (backend : core/mixins.py, CirculationMixin).
 */
export const SOURCES_DOSSIER = {
  absence: '/rh/demandes-absence',
  requisition: '/finance/requisitions',
  depense: '/finance/depenses',
  mission: '/finance/missions',
  'sortie-caisse': '/finance/sorties-caisse',
  'bon-commande': '/finance/bons-commande',
  prestation: '/finance/prestations',
} as const;

export type SourceDossier = keyof typeof SOURCES_DOSSIER;

export function estSourceDossier(valeur: string | undefined): valeur is SourceDossier {
  return !!valeur && valeur in SOURCES_DOSSIER;
}

export type EvenementDossier = {
  id: number;
  type: 'SOUMISSION' | 'MESSAGE' | 'MISE_EN_ATTENTE' | 'REPRISE' | 'MODIFICATION' | 'APPROBATION' | 'REJET';
  type_libelle: string;
  auteur: string;
  auteur_id: number | null;
  texte: string;
  contexte: string;
  version: number | null;
  date: string;
};

export type VersionDossier = {
  numero: number;
  date: string;
  auteur: string;
  type: string;
  champs: Record<string, { libelle: string; valeur: string }>;
  changements: { libelle: string; avant: string; apres: string }[];
};

export type EtapeDossier = {
  id: number;
  ordre: number;
  libelle: string;
  decision: string;
  decision_libelle?: string;
  decide_par_nom?: string;
  date_decision?: string | null;
  commentaire?: string;
  nature?: string;
};

export type EtatDossier = {
  type_libelle: string;
  document: {
    id: number;
    numero: string;
    statut: string;
    statut_libelle: string;
    demandeur: number;
    demandeur_nom: string;
    demandeur_email?: string;
    demandeur_departement_nom?: string;
    etape_courante_libelle: string;
    motif_rejet?: string;
    etapes: EtapeDossier[];
    en_attente: boolean;
  };
  resume: { libelle: string; valeur: string }[];
  evenements: EvenementDossier[];
  versions: VersionDossier[];
  en_attente: boolean;
  est_demandeur: boolean;
  peut_decider: boolean;
  peut_mettre_en_attente: boolean;
  peut_reprendre: boolean;
  peut_ecrire: boolean;
};

const base = (source: SourceDossier, id: number) => `${SOURCES_DOSSIER[source]}/${id}`;

export const lireDossier = (source: SourceDossier, id: number) => apiFetch<EtatDossier>(`${base(source, id)}/dossier/`);

export const envoyerMessage = (source: SourceDossier, id: number, texte: string) =>
  apiFetch<EtatDossier>(`${base(source, id)}/echanger/`, { method: 'POST', corps: { texte } });

export const mettreEnAttente = (source: SourceDossier, id: number, motif: string) =>
  apiFetch<EtatDossier>(`${base(source, id)}/mettre-en-attente/`, { method: 'POST', corps: { motif } });

export const reprendreDossier = (source: SourceDossier, id: number, texte = '') =>
  apiFetch<EtatDossier>(`${base(source, id)}/reprendre/`, { method: 'POST', corps: { texte } });

export const approuverDossier = (source: SourceDossier, id: number, commentaire = '') =>
  apiFetch<unknown>(`${base(source, id)}/valider/`, { method: 'POST', corps: { commentaire } });

export const refuserDossier = (source: SourceDossier, id: number, commentaire: string) =>
  apiFetch<unknown>(`${base(source, id)}/rejeter/`, { method: 'POST', corps: { commentaire } });
