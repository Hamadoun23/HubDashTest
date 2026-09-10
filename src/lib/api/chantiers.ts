/** Endpoints du module Chantiers (`/api/chantiers/...`) du backend réel.
 * Un "chantier" côté hub correspond à un "projet" côté backend. De nombreux
 * endpoints (tâches, mises à jour journalières, photos, dashboard, génération
 * de rapport) ne prennent PAS l'id du projet dans l'URL : ils le résolvent via
 * l'en-tête `X-Project-Id` (sinon ils retombent silencieusement sur le premier
 * projet accessible à l'utilisateur). Toute fonction touchant ces endpoints
 * prend donc un `chantierId` obligatoire et le traduit en cet en-tête — voir
 * `enteteProjet` ci-dessous. Ne jamais oublier cet en-tête sur ces endpoints :
 * l'appel réussit quand même mais renvoie les données du mauvais chantier. */
import { ApiError, apiFetch, jetonAcces } from './client';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

function requete(params: Record<string, string | number | boolean | undefined>) {
  const filtres = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  const chaine = new URLSearchParams(filtres.map(([k, v]) => [k, String(v)])).toString();
  return chaine ? `?${chaine}` : '';
}

/** Toutes les listes de ce module sont paginées DRF standard. */
export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };

function resultats<T>(page: Page<T>): T[] {
  return page.results;
}

/** En-tête à passer sur les endpoints qui résolvent le projet via `X-Project-Id`
 * plutôt que via l'id dans l'URL (voir en-tête du fichier). */
function enteteProjet(chantierId: number): Record<string, string> {
  return { 'X-Project-Id': String(chantierId) };
}

// --- Projets (chantiers) -----------------------------------------------------

export type StatutProjet = 'planifie' | 'en_cours' | 'termine' | 'suspendu';

export type Projet = {
  id: number;
  name: string;
  description: string;
  client: string;
  start_date: string | null;
  end_date: string | null;
  status: StatutProjet;
  status_display: string;
  overall_progress: number;
  progress_by_phase: Record<string, number>;
  tasks_count: number;
  user_ids: number[];
  user_names: string[];
  created_at: string;
  updated_at: string;
};

export type NouveauProjet = {
  name: string;
  description?: string;
  client?: string;
  start_date?: string;
  end_date?: string;
  status?: StatutProjet;
};

export async function listerProjets(params: { status?: StatutProjet; search?: string } = {}) {
  const page = await apiFetch<Page<Projet>>(`/chantiers/projets/${requete(params)}`);
  return resultats(page);
}

export function obtenirProjet(id: number) {
  return apiFetch<Projet>(`/chantiers/projets/${id}/`);
}

export function creerProjet(payload: NouveauProjet) {
  return apiFetch<Projet>('/chantiers/projets/', { method: 'POST', corps: payload });
}

export function modifierProjet(id: number, payload: Partial<NouveauProjet>) {
  return apiFetch<Projet>(`/chantiers/projets/${id}/`, { method: 'PATCH', corps: payload });
}

export function supprimerProjet(id: number) {
  return apiFetch<void>(`/chantiers/projets/${id}/`, { method: 'DELETE' });
}

// --- Structure du projet (phases → sous-phases → tâches) ---------------------

export type Phase = { id: number; name: string; sort_order: number; hidden_from_partner: boolean };
export type NouvellePhase = { projet: number; name: string; sort_order?: number; hidden_from_partner?: boolean };

export type SousPhase = { id: number; name: string; sort_order: number; hidden_from_partner: boolean };
export type NouvelleSousPhase = { phase: number; name: string; sort_order?: number; hidden_from_partner?: boolean };

export type SousPhaseStructure = SousPhase & { tasks: Tache[] };
export type PhaseStructure = Phase & { sub_phases: SousPhaseStructure[] };
export type StructureProjet = { id: number; name: string; phases: PhaseStructure[] };

/** L'id du projet est dans l'URL ici — pas d'en-tête `X-Project-Id` nécessaire. */
export function obtenirStructure(chantierId: number) {
  return apiFetch<StructureProjet>(`/chantiers/projets/${chantierId}/structure/`);
}

export async function listerPhases(projetId: number) {
  const page = await apiFetch<Page<Phase>>(`/chantiers/phases/${requete({ projet: projetId })}`);
  return resultats(page);
}

export function creerPhase(payload: NouvellePhase) {
  return apiFetch<Phase>('/chantiers/phases/', { method: 'POST', corps: payload });
}

export async function listerSousPhases(phaseId: number) {
  const page = await apiFetch<Page<SousPhase>>(`/chantiers/sous-phases/${requete({ phase: phaseId })}`);
  return resultats(page);
}

export function creerSousPhase(payload: NouvelleSousPhase) {
  return apiFetch<SousPhase>('/chantiers/sous-phases/', { method: 'POST', corps: payload });
}

// --- Tâches --------------------------------------------------------------------

export type NoteProgression = {
  id: number;
  tache: number;
  user_id: number;
  user_name: string;
  daily_update_id: number | null;
  progress: number;
  previous_progress: number;
  body: string;
  created_at: string;
};

export type Tache = {
  id: number;
  sous_phase_id: number;
  phase_id: number;
  phase: string;
  subphase: string;
  activity: string;
  start_day: number | null;
  duration_days: number | null;
  sort_order: number;
  hidden_from_partner: boolean;
  progress: number;
  status: string;
  status_label: string;
  status_comment: string;
  progress_notes_count: number;
  progress_notes: NoteProgression[];
};

export type TacheDetailComplete = Tache & { daily_updates: MiseAJour[] };

export type NouvelleTache = {
  sous_phase: number;
  activity: string;
  start_day?: number;
  duration_days?: number;
  sort_order?: number;
  hidden_from_partner?: boolean;
};

export async function listerTaches(chantierId: number, params: { sous_phase?: number } = {}) {
  const page = await apiFetch<Page<Tache>>(`/chantiers/taches/${requete(params)}`, { entetes: enteteProjet(chantierId) });
  return resultats(page);
}

export function creerTache(chantierId: number, payload: NouvelleTache) {
  return apiFetch<Tache>('/chantiers/taches/', { method: 'POST', corps: payload, entetes: enteteProjet(chantierId) });
}

export function obtenirTacheDetailComplete(id: number) {
  return apiFetch<TacheDetailComplete>(`/chantiers/taches/${id}/detail-complete/`);
}

// --- Mises à jour journalières (saisie du jour) ---------------------------------

export type MiseAJour = {
  id: number;
  tache: number;
  task_id: number;
  user_id: number;
  user_name: string;
  report_date: string;
  progress: number;
  status: string;
  status_label: string;
  comment: string;
};

export type NouvelleMiseAJour = {
  task_id: number;
  date?: string;
  progress: number;
  status?: string;
  comment?: string;
  progress_note?: string;
};

export function creerMiseAJour(chantierId: number, payload: NouvelleMiseAJour) {
  return apiFetch<MiseAJour>('/chantiers/mises-a-jour/', { method: 'POST', corps: payload, entetes: enteteProjet(chantierId) });
}

export function modifierMiseAJour(chantierId: number, id: number, payload: Partial<NouvelleMiseAJour>) {
  return apiFetch<MiseAJour>(`/chantiers/mises-a-jour/${id}/`, { method: 'PATCH', corps: payload, entetes: enteteProjet(chantierId) });
}

export type ElementJour = {
  task: Tache;
  daily_update: MiseAJour | null;
  effective_progress: number;
  effective_status: string;
};

export type VueDuJour = { date: string; items: ElementJour[] };

export function vueDuJour(chantierId: number, date?: string) {
  return apiFetch<VueDuJour>(`/chantiers/mises-a-jour/daily/${requete({ date })}`, { entetes: enteteProjet(chantierId) });
}

export type ElementLot = { task_id: number; progress: number; status?: string; comment?: string; progress_note?: string };
export type ResultatLot = { created: MiseAJour[]; errors: unknown[] };

export function saisirEnLot(chantierId: number, date: string, updates: ElementLot[]) {
  return apiFetch<ResultatLot>('/chantiers/mises-a-jour/batch/', {
    method: 'POST',
    corps: { date, updates },
    entetes: enteteProjet(chantierId),
  });
}

// --- Photos ----------------------------------------------------------------------

export type CategoriePhoto = 'avant' | 'pendant' | 'apres' | 'securite' | 'qualite';

export type Photo = {
  id: number;
  category: CategoriePhoto;
  category_display: string;
  url: string;
  original_name: string;
  caption: string;
  taken_at: string | null;
  file_size: number;
  created_at: string;
};

export async function listerPhotos(chantierId: number) {
  const page = await apiFetch<Page<Photo>>('/chantiers/photos/', { entetes: enteteProjet(chantierId) });
  return resultats(page);
}

export function televerserPhoto(
  chantierId: number,
  fichier: File,
  payload: { category: CategoriePhoto; caption?: string; taken_at?: string },
) {
  const corps = new FormData();
  corps.append('file', fichier);
  corps.append('category', payload.category);
  if (payload.caption) corps.append('caption', payload.caption);
  if (payload.taken_at) corps.append('taken_at', payload.taken_at);
  return apiFetch<Photo>('/chantiers/photos/', { method: 'POST', corps, entetes: enteteProjet(chantierId) });
}

/** Pas de suppression unitaire côté API — seulement en lot, même pour une seule photo. */
export function supprimerPhotos(chantierId: number, ids: number[]) {
  return apiFetch<{ deleted: number }>('/chantiers/photos/bulk-delete/', {
    method: 'POST',
    corps: { ids },
    entetes: enteteProjet(chantierId),
  });
}

// --- Journal d'activité -----------------------------------------------------------

export type EntreeJournal = {
  id: number;
  action: string;
  description: string;
  user_name: string;
  project_id: number;
  ip_address: string | null;
  created_at: string;
};

export type JournalReponse = {
  logs: EntreeJournal[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  filters: { actions: string[] };
};

export function listerJournal(
  chantierId: number,
  params: { action?: string; q?: string; from?: string; to?: string; page?: number; per_page?: number } = {},
) {
  return apiFetch<JournalReponse>(`/chantiers/activity-logs/${requete({ ...params, project_id: chantierId })}`);
}

// --- Rapports ----------------------------------------------------------------------

export type Rapport = {
  id: number;
  projet: number;
  report_date: string;
  temperature: string | null;
  weather: string;
  page_number: number | null;
  overall_progress: number | null;
  notes: string;
};

export type NouveauRapport = {
  report_date: string;
  temperature?: string;
  weather?: string;
  page_number?: number;
  overall_progress?: number;
  notes?: string;
};

export async function listerRapports(chantierId: number) {
  const page = await apiFetch<Page<Rapport>>(`/chantiers/rapports/${requete({ projet: chantierId })}`);
  return resultats(page);
}

export function creerRapport(chantierId: number, payload: NouveauRapport) {
  return apiFetch<Rapport>('/chantiers/rapports/', { method: 'POST', corps: { ...payload, projet: chantierId } });
}

export type StatistiquesGeneration = {
  total_tasks: number;
  done_tasks: number;
  in_progress_tasks: number;
  overall_progress: number;
  page_count: number;
};

export type GenerationRapport = {
  report: Rapport;
  statistics: StatistiquesGeneration;
  tasks: Tache[];
};

export type ParametresGeneration = { report_date?: string; temperature?: string; weather?: string; notes?: string };

export function genererRapport(chantierId: number, payload: ParametresGeneration = {}) {
  return apiFetch<GenerationRapport>('/chantiers/rapports/generate/', {
    method: 'POST',
    corps: payload,
    entetes: enteteProjet(chantierId),
  });
}

/** Le PDF est un fichier binaire protégé par le jeton d'accès : impossible de
 * l'obtenir via un simple lien `<a href>`. On le récupère nous-mêmes en blob
 * puis on déclenche le téléchargement via un lien objet temporaire. */
export async function telechargerRapportPdf(id: number, nomFichier = `rapport-${id}.pdf`): Promise<void> {
  const jeton = jetonAcces();
  const reponse = await fetch(`${BASE_URL}/chantiers/rapports/${id}/pdf/`, {
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
  });

  if (!reponse.ok) {
    throw new ApiError('Impossible de télécharger le rapport PDF', reponse.status, null);
  }

  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

// --- Météo (proxy Open-Meteo) ------------------------------------------------------

/** La forme exacte dépend d'Open-Meteo (proxy transparent) : on ne la fige pas
 * au-delà de ce qui est garanti (des objets de valeurs indexées par nom de
 * variable), l'affichage reste défensif dans `Meteo.tsx`. */
export type Meteo = {
  current?: Record<string, unknown>;
  daily?: Record<string, unknown>;
};

export function obtenirMeteo(lat: number, lon: number) {
  return apiFetch<Meteo>(`/chantiers/weather/${requete({ lat, lon, endpoint: 'forecast' })}`);
}

// --- Tableau de bord -----------------------------------------------------------------

export type Dashboard = {
  project: { id: number; name: string; client: string };
  overall_progress: number;
  stats: { total: number; done: number; in_progress: number; not_started: number; cancelled: number };
  status_counts: Record<string, number>;
  progress_by_phase: { phase: string; progress: number; task_count: number }[];
  activities: unknown[];
  recent_activity: unknown[];
};

export function obtenirTableauDeBord(chantierId: number) {
  return apiFetch<Dashboard>('/chantiers/dashboard/', { entetes: enteteProjet(chantierId) });
}
