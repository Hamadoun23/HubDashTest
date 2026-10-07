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
  type: 'SOUMISSION' | 'MESSAGE' | 'MISE_EN_ATTENTE' | 'REPRISE' | 'MODIFICATION' | 'APPROBATION' | 'REJET' | 'RELANCE';
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
  /** Étapes qui attendent encore une décision, et qui est attendu. */
  attendus: { etape: string; qui: string }[];
  peut_relancer: boolean;
  /** Étape qui revient à la personne connectée : un avis, ou la décision finale. */
  mon_etape: { libelle: string; nature: 'DECISION' | 'AVIS' | 'INFORMATION' } | null;
  /** Nouvelle relance possible à partir de cette date (ISO), si une relance récente bloque. */
  prochaine_relance: string | null;
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

export const relancerDossier = (source: SourceDossier, id: number, texte = '') =>
  apiFetch<EtatDossier>(`${base(source, id)}/relancer/`, { method: 'POST', corps: { texte } });

// --- Historique : toutes les demandes, tous types confondus -----------------

export type CategorieHistorique = 'CONGE' | 'PERMISSION' | 'RETARD' | 'FINANCE';

export type LigneHistorique = {
  cle: string;
  source: SourceDossier;
  id: number;
  numero: string;
  categorie: CategorieHistorique;
  type: string;
  demandeur_nom: string;
  demandeur_email?: string;
  detail: string;
  statut: string;
  statut_libelle: string;
  cree_le: string;
};

type Page<T> = { results: T[]; next: string | null } | T[];

/** Toutes les pages d'une liste DRF (le service pagine par 25). */
async function toutesLesPages<T>(chemin: string): Promise<T[]> {
  const resultat: T[] = [];
  for (let page = 1; page <= 40; page++) {
    const donnees = await apiFetch<Page<T>>(`${chemin}?page=${page}`);
    if (Array.isArray(donnees)) return donnees;
    resultat.push(...donnees.results);
    if (!donnees.next) break;
  }
  return resultat;
}

type Brut = Record<string, unknown> & { id: number; numero: string; statut: string; statut_libelle: string; cree_le: string; demandeur_nom: string; demandeur_email?: string };

const FINANCES: { source: SourceDossier; type: string }[] = [
  { source: 'requisition', type: 'Réquisition' },
  { source: 'depense', type: 'Dépense' },
  { source: 'mission', type: 'Mission' },
  { source: 'sortie-caisse', type: 'Sortie de caisse' },
  { source: 'prestation', type: 'Prestation' },
  { source: 'bon-commande', type: 'Bon de commande' },
];

const fcfa = (v: unknown) => (v === null || v === undefined || v === '' ? '' : `${Number(v).toLocaleString('fr-FR')} F`);

/**
 * Congés, permissions, retards et demandes financières visibles par la
 * personne (les siennes, celles de son équipe, tout pour le back-office),
 * brouillons exclus. Un type indisponible n'empêche pas les autres.
 */
export async function chargerHistorique(): Promise<LigneHistorique[]> {
  const absences = toutesLesPages<Brut & { type_absence_libelle: string; categorie: string; date_debut: string; date_fin: string }>('/rh/demandes-absence/')
    .then((liste) =>
      liste.map<LigneHistorique>((d) => ({
        cle: `absence-${d.id}`,
        source: 'absence',
        id: d.id,
        numero: d.numero,
        categorie: (['CONGE', 'PERMISSION', 'RETARD'].includes(d.categorie) ? d.categorie : 'CONGE') as CategorieHistorique,
        type: d.type_absence_libelle,
        demandeur_nom: d.demandeur_nom,
        demandeur_email: d.demandeur_email,
        detail: d.date_debut === d.date_fin ? d.date_debut : `${d.date_debut} → ${d.date_fin}`,
        statut: d.statut,
        statut_libelle: d.statut_libelle,
        cree_le: d.cree_le,
      })),
    )
    .catch(() => [] as LigneHistorique[]);
  const finances = FINANCES.map(({ source, type }) =>
    toutesLesPages<Brut>(`${SOURCES_DOSSIER[source]}/`)
      .then((liste) =>
        liste.map<LigneHistorique>((d) => {
          const objet = String(d.objet ?? d.libelle ?? d.motif ?? '');
          const montant = fcfa(d.montant);
          return {
            cle: `${source}-${d.id}`,
            source,
            id: d.id,
            numero: d.numero,
            categorie: 'FINANCE',
            type: objet ? `${type} — ${objet}` : type,
            demandeur_nom: d.demandeur_nom,
            demandeur_email: d.demandeur_email,
            detail: montant,
            statut: d.statut,
            statut_libelle: d.statut_libelle,
            cree_le: d.cree_le,
          };
        }),
      )
      .catch(() => [] as LigneHistorique[]),
  );
  const toutes = (await Promise.all([absences, ...finances])).flat();
  return toutes.filter((l) => l.statut !== 'BROUILLON').sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1));
}
