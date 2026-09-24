/** Endpoints du service `planning` (`/api/planning/...`). Formes de payload d'après
 * le rapport d'exploration du code réel de `backend/planning`. */
import { apiFetch, jetonAcces } from './client';

function requete(params: Record<string, string | number | boolean | undefined>) {
  const filtres = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  const chaine = new URLSearchParams(filtres.map(([k, v]) => [k, String(v)])).toString();
  return chaine ? `?${chaine}` : '';
}

type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };

async function liste<T>(chemin: string): Promise<T[]> {
  const donnees = await apiFetch<Page<T>>(chemin);
  return donnees.results;
}

// --- Statuts communs à Tournage et Publication -------------------------------

export type StatutEvenement = 'pending' | 'completed' | 'not_realized' | 'cancelled' | 'rescheduled';

export const LIBELLES_STATUT: Record<StatutEvenement, string> = {
  pending: 'En attente',
  completed: 'Réalisé',
  not_realized: 'Non réalisé',
  cancelled: 'Annulé',
  rescheduled: 'Reprogrammé',
};

// --- Clients -------------------------------------------------------------

export type ClientPlanning = {
  id: number;
  nom_entreprise: string;
  created_at: string;
  tournages_count: number;
  publications_count: number;
};

export function listerClients(recherche = '') {
  return liste<ClientPlanning>(`/planning/clients/${requete({ search: recherche })}`);
}

export function creerClient(nom_entreprise: string) {
  return apiFetch<ClientPlanning>('/planning/clients/', { method: 'POST', corps: { nom_entreprise } });
}

export type JourCalendrier = {
  date: string;
  est_mois_courant: boolean;
  tournages: Tournage[];
  publications: Publication[];
  avertissement?: string | null;
};

export type StatsClient = {
  total_shootings: number;
  pending_shootings: number;
  completed_shootings: number;
  cancelled_shootings: number;
  non_realises_shootings: number;
  total_publications: number;
  pending_publications: number;
  completed_publications: number;
  cancelled_publications: number;
  non_realises_publications: number;
  publication_rules: number;
};

export type RegleClient = { id: number; client: number; day_of_week: string };

export type RapportClient = {
  id: number;
  client: number;
  report_type: 'monthly' | 'annual';
  report_type_libelle: string;
  report_date: string;
  file_url: string;
  original_filename: string;
  file_size: number;
  uploaded_at: string;
};

export type CalendrierClient = {
  client: ClientPlanning;
  mois: number;
  annee: number;
  calendrier: JourCalendrier[][];
  stats: StatsClient;
  tournages_a_venir: Tournage[];
  publications_a_venir: Publication[];
  tournages_recents: Tournage[];
  publications_recentes: Publication[];
  rapports_mensuels: RapportClient[];
  rapports_annuels: RapportClient[];
  lecture_seule: boolean;
};

export function calendrierClient(clientId: number, mois: number, annee: number) {
  return apiFetch<CalendrierClient>(`/planning/clients/${clientId}/calendrier/${requete({ month: mois, year: annee })}`);
}

export function reglesClient(clientId: number) {
  return apiFetch<RegleClient[] | { results: RegleClient[] }>(
    `/planning/regles-publication/${requete({ client: clientId })}`,
  ).then((d) => (Array.isArray(d) ? d : d.results));
}

export function genererRapportPlanning(clientId: number, typePeriode: 'monthly' | 'annual', mois: number, annee: number) {
  const nomFichier = typePeriode === 'annual' ? `planning-annuel-${annee}.pdf` : `planning-${annee}-${String(mois).padStart(2, '0')}.pdf`;
  return telechargerFichier(
    `/planning/clients/${clientId}/rapport-genere/${requete({ type: typePeriode, month: mois, year: annee })}`,
    nomFichier,
  );
}

export function telechargerRapportClient(clientId: number, rapport: RapportClient) {
  return telechargerFichier(`/planning/clients/${clientId}/rapports/${rapport.id}/`, rapport.original_filename);
}

export function uploaderRapportClient(
  clientId: number,
  payload: { report_type: 'monthly' | 'annual'; report_date: string; file: File },
) {
  const donnees = new FormData();
  donnees.append('report_type', payload.report_type);
  donnees.append('report_date', payload.report_date);
  donnees.append('file', payload.file);
  return apiFetch<RapportClient>(`/planning/clients/${clientId}/rapports/`, { method: 'POST', corps: donnees });
}

export function supprimerRapportClient(clientId: number, rapportId: number) {
  return apiFetch<void>(`/planning/clients/${clientId}/rapports/${rapportId}/`, { method: 'DELETE' });
}

// --- Idées de contenu ------------------------------------------------------

export type IdeeContenu = { id: number; titre: string; type: string; created_at: string };

export function listerIdees(recherche = '') {
  return liste<IdeeContenu>(`/planning/idees-contenu/${requete({ search: recherche })}`);
}

export function creerIdee(titre: string, type: string) {
  return apiFetch<IdeeContenu>('/planning/idees-contenu/', { method: 'POST', corps: { titre, type } });
}

export function modifierIdee(id: number, titre: string, type: string) {
  return apiFetch<IdeeContenu>(`/planning/idees-contenu/${id}/`, { method: 'PATCH', corps: { titre, type } });
}

export function supprimerIdee(id: number) {
  return apiFetch<void>(`/planning/idees-contenu/${id}/`, { method: 'DELETE' });
}

// --- Tournages ---------------------------------------------------------------

export type Tournage = {
  id: number;
  client: number;
  client_nom: string;
  date: string;
  status: StatutEvenement;
  status_reason: string;
  description: string;
  content_ideas_detail: IdeeContenu[];
  is_overdue: boolean;
  is_upcoming: boolean;
  requires_action: boolean;
};

export type NouveauTournage = {
  client: number;
  date: string;
  status?: StatutEvenement;
  status_reason?: string;
  description?: string;
  content_idea_ids?: number[];
};

export function listerTournages(recherche = '') {
  return liste<Tournage>(`/planning/tournages/${requete({ search: recherche })}`);
}

export function obtenirTournage(id: number) {
  return apiFetch<Tournage>(`/planning/tournages/${id}/`);
}

export type CalendrierMoisReponse = { mois: number; annee: number; calendrier: JourCalendrier[][] };

/** `ShootingController::index` — calendrier du mois, non paginé (contrairement
 * à `listerTournages()`, plafonnée à 50 résultats par le backend). */
export function calendrierTournages(mois: number, annee: number, clientId?: string) {
  return apiFetch<CalendrierMoisReponse>(`/planning/tournages/calendrier/${requete({ month: mois, year: annee, client_id: clientId })}`);
}

export function creerTournage(payload: NouveauTournage) {
  return apiFetch<Tournage>('/planning/tournages/', { method: 'POST', corps: payload });
}

export function modifierTournage(id: number, payload: Partial<NouveauTournage>) {
  return apiFetch<Tournage>(`/planning/tournages/${id}/`, { method: 'PATCH', corps: payload });
}

export function supprimerTournage(id: number) {
  return apiFetch<void>(`/planning/tournages/${id}/`, { method: 'DELETE' });
}

export function changerStatutTournage(id: number, statut: StatutEvenement, status_reason?: string, reschedule_date?: string) {
  return apiFetch<Tournage>(`/planning/tournages/${id}/statut/`, {
    method: 'POST',
    corps: { status: statut, status_reason, reschedule_date },
  });
}

export function reprogrammerTournage(id: number, new_date: string) {
  return apiFetch<Tournage>(`/planning/tournages/${id}/reprogrammer/`, { method: 'POST', corps: { new_date } });
}

// --- Publications --------------------------------------------------------

export type Publication = {
  id: number;
  client: number;
  client_nom: string;
  date: string;
  content_idea: number | null;
  content_idea_detail: IdeeContenu | null;
  shooting: number | null;
  shooting_date: string | null;
  status: StatutEvenement;
  status_reason: string;
  description: string;
  is_overdue: boolean;
  is_upcoming: boolean;
  requires_action: boolean;
  day_not_recommended_warning: string | null;
};

export type NouvellePublication = {
  client: number;
  date: string;
  content_idea?: number | null;
  shooting?: number | null;
  status?: StatutEvenement;
  status_reason?: string;
  description?: string;
};

type ReponseAvecAvertissements<T> = T & { avertissements: string[] };

export function listerPublications(recherche = '') {
  return liste<Publication>(`/planning/publications/${requete({ search: recherche })}`);
}

export function obtenirPublication(id: number) {
  return apiFetch<Publication>(`/planning/publications/${id}/`);
}

/** `PublicationController::index` — calendrier du mois, non paginé (contrairement
 * à `listerPublications()`, plafonnée à 50 résultats par le backend — avec
 * 512 publications au total, le calendrier raterait celles du mois affiché). */
export function calendrierPublications(mois: number, annee: number, clientId?: string) {
  return apiFetch<CalendrierMoisReponse>(`/planning/publications/calendrier/${requete({ month: mois, year: annee, client_id: clientId })}`);
}

export function creerPublication(payload: NouvellePublication) {
  return apiFetch<ReponseAvecAvertissements<Publication>>('/planning/publications/', { method: 'POST', corps: payload });
}

export function modifierPublication(id: number, payload: Partial<NouvellePublication>) {
  return apiFetch<ReponseAvecAvertissements<Publication>>(`/planning/publications/${id}/`, { method: 'PATCH', corps: payload });
}

export function supprimerPublication(id: number) {
  return apiFetch<void>(`/planning/publications/${id}/`, { method: 'DELETE' });
}

export function verifierDatePublication(clientId: number, date: string, exclureId?: number) {
  return apiFetch<{ avertissements: string[] }>(
    `/planning/publications/verifier-date/${requete({ client_id: clientId, date, exclude: exclureId })}`,
  );
}

export function changerStatutPublication(id: number, statut: StatutEvenement, status_reason?: string, reschedule_date?: string) {
  return apiFetch<Publication>(`/planning/publications/${id}/statut/`, {
    method: 'POST',
    corps: { status: statut, status_reason, reschedule_date },
  });
}

/** Distinct du statut "Reprogrammé" (qui déplace l'événement en place) :
 * ceci crée un nouvel événement à la nouvelle date et marque l'ancien
 * `cancelled` — comportement d'origine (`reschedule()` Laravel), utile pour
 * garder une trace de l'annulation plutôt que de la masquer. */
export function reprogrammerPublication(id: number, new_date: string) {
  return apiFetch<Publication>(`/planning/publications/${id}/reprogrammer/`, { method: 'POST', corps: { new_date } });
}

// --- Tableau de bord (calendrier global, tous clients) -----------------------

export type TableauDeBordPlanningDonnees = {
  mois: number;
  annee: number;
  calendrier: JourCalendrier[][];
  stats: { clients_count: number; shootings_this_month: number; publications_this_month: number };
  tournages_en_retard: Tournage[];
  publications_en_retard: Publication[];
  tournages_a_venir: Tournage[];
  publications_a_venir: Publication[];
  tournages_prochains: Tournage[];
  publications_prochains: Publication[];
};

export function tableauDeBord(mois: number, annee: number, clientId?: string) {
  return apiFetch<TableauDeBordPlanningDonnees>(
    `/planning/tableau-de-bord/${requete({ month: mois, year: annee, client_id: clientId && clientId !== 'all' ? clientId : undefined })}`,
  );
}

export type PeriodeRapport = 'weekly' | 'monthly' | 'annual';

/** `DashboardController::generateReport` — rapport global (tous clients ou un
 * seul), sur une période hebdo/mensuelle/annuelle. */
export function genererRapportGlobal(periode: PeriodeRapport, clientId: string) {
  const libelles: Record<PeriodeRapport, string> = { weekly: 'hebdo', monthly: 'mensuel', annual: 'annuel' };
  const suffixe = clientId === 'all' ? 'tous-clients' : `client-${clientId}`;
  return telechargerFichier(
    `/planning/tableau-de-bord/rapport/${requete({ period: periode, client_id: clientId })}`,
    `rapport-${libelles[periode]}-${suffixe}.pdf`,
  );
}

/** Téléchargement d'un fichier protégé par jeton (CSV/PDF/DOC) : `fetch` direct
 * (apiFetch attend du JSON) avec le header Authorization, puis déclenchement du
 * téléchargement via un lien temporaire. */
export async function telechargerFichier(chemin: string, nomFichier: string) {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';
  const reponse = await fetch(`${base}${chemin}`, {
    headers: jetonAcces() ? { Authorization: `Bearer ${jetonAcces()}` } : {},
  });
  if (!reponse.ok) throw new Error("Impossible de télécharger le fichier.");
  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

export function exporterTournagesCsv(mois: number, annee: number) {
  return telechargerFichier(`/planning/tournages/export/${requete({ month: mois, year: annee })}`, `tournages-${annee}-${mois}.csv`);
}

export function exporterPublicationsCsv(mois: number, annee: number) {
  return telechargerFichier(
    `/planning/publications/export/${requete({ month: mois, year: annee })}`,
    `publications-${annee}-${mois}.csv`,
  );
}

// --- Statistiques (contenu réalisé) --------------------------------------

export type PointStatSemaine = { debut: string; fin: string; tournages: number; publications: number };
export type PointStatMois = { mois: number; annee: number; tournages: number; publications: number };
export type PointStatAnnee = { annee: number; tournages: number; publications: number };
export type PointStatClient = {
  client: string;
  tournages: number;
  publications: number;
  tournages_non_realises: number;
  publications_non_realisees: number;
};

export type CompteParStatut = Record<StatutEvenement, number>;
export type PointStatTypeIdee = { type: string; total: number; realisees: number };

export type StatistiquesDonnees = {
  par_semaine: PointStatSemaine[];
  par_mois: PointStatMois[];
  par_annee: PointStatAnnee[];
  par_client: PointStatClient[];
  statuts: { tournages: CompteParStatut; publications: CompteParStatut };
  idees: { total: number; realisees: number; par_type: PointStatTypeIdee[] };
  clients: { total: number; actifs: number };
};

export function statistiques(clientId?: string) {
  return apiFetch<StatistiquesDonnees>(`/planning/statistiques/${requete({ client_id: clientId })}`);
}
