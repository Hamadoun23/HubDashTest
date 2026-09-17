/** Authentification via le service `identity` (`/api/identity/auth/...`) —
 * le vrai point d'entrée du hub : un compte unique, qui renvoie la liste des
 * applications auxquelles l'utilisateur a accès. Le jeton d'accès obtenu ici
 * (RS256) est aussi accepté par les backends métier (financerh, jusorange...)
 * via le pont JWKS — voir rapport d'exploration, `AuthentificationHub`. */
import { apiFetch, definirJetons } from './client';

export type Departement = {
  id: number;
  code: string;
  nom: string;
  responsable: number | null;
  responsable_nom: string;
  effectif: number;
  ordre: number;
  actif: boolean;
};

export type Application = {
  id: number;
  code: string;
  nom: string;
  description: string;
  groupe: string;
  /** L'organigramme réel (RH, Finance, Communication...), distinct de
   * `groupe` qui n'est qu'un intitulé de section du menu. Une application
   * peut servir plusieurs départements (FinanceRH sert RH et Finance). */
  departements: Departement[];
  chemin: string;
  prefixe_api: string;
  roles_disponibles: { code: string; libelle: string }[];
  couleur: string;
  ordre: number;
  active: boolean;
  roles: string[];
};

export type IdentiteUtilisateur = {
  id: number;
  identifiant: string;
  nom_complet: string;
  email: string;
  fonction: string;
  est_superadmin: boolean;
  photo: string | null;
};

type ReponseIdentite = {
  acces: string;
  rafraichissement: string;
  utilisateur: IdentiteUtilisateur;
  habilitations: Record<string, string[]>;
  applications: Application[];
};

export async function connexionIdentity(identifiant: string, mot_de_passe: string): Promise<ReponseIdentite> {
  const reponse = await apiFetch<ReponseIdentite>('/identity/auth/connexion', {
    method: 'POST',
    corps: { identifiant, mot_de_passe },
    authentifie: false,
  });
  definirJetons({ access: reponse.acces, refresh: reponse.rafraichissement });
  return reponse;
}

export function moi() {
  return apiFetch<IdentiteUtilisateur>('/identity/auth/moi');
}

export function changerPhoto(fichier: File) {
  const corps = new FormData();
  corps.append('photo', fichier);
  return apiFetch<IdentiteUtilisateur>('/identity/auth/moi/photo', { method: 'POST', corps });
}

export function supprimerPhoto() {
  return apiFetch<IdentiteUtilisateur>('/identity/auth/moi/photo', { method: 'DELETE' });
}

export function changerMotDePasseIdentity(ancien: string, nouveau: string) {
  return apiFetch<void>('/identity/auth/mot-de-passe', { method: 'POST', corps: { ancien, nouveau } });
}

// --- Administration (réservé aux admins du hub — EstAdminHub) --------------
// Le routeur DRF d'identity n'a pas de barre oblique finale (voir
// backend/identity/comptes/urls.py : `DefaultRouter(trailing_slash=False)`).

export type Habilitation = {
  id: number;
  utilisateur: number;
  application: number;
  application_code: string;
  application_nom: string;
  roles: string[];
  identifiant_local: string;
  active: boolean;
  accordee_le: string;
};

export type UtilisateurAdmin = {
  id: number;
  identifiant: string;
  nom: string;
  prenom: string;
  nom_complet: string;
  email: string;
  telephone: string;
  fonction: string;
  departement: number | null;
  departement_nom: string;
  est_actif: boolean;
  is_superuser: boolean;
  derniere_connexion: string | null;
  cree_le: string;
  habilitations: Habilitation[];
};

export type NouvelUtilisateur = {
  identifiant: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  fonction?: string;
  departement?: number | null;
  est_actif?: boolean;
  is_superuser?: boolean;
  mot_de_passe: string;
};

// La pagination d'identity suit `PaginationGdaHub` (libs/gdahub_common) : des
// clés en français (`resultats`, `total`, `page`...), différentes du DRF
// standard (`results`, `count`) utilisé par les autres services (financerh...).
function listeOuResultats<T>(donnees: { resultats: T[] } | T[]): T[] {
  return Array.isArray(donnees) ? donnees : donnees.resultats;
}

export async function listerUtilisateursAdmin(params: { est_actif?: boolean; recherche?: string } = {}) {
  const { recherche, ...reste } = params;
  // Pas de pagination côté écran pour l'instant : `taille` au maximum
  // (`max_page_size` de PaginationGdaHub) pour tout ramener en un appel.
  const filtres = Object.entries({ ...reste, search: recherche, taille: 200 }).filter(([, v]) => v !== undefined && v !== '');
  const chaine = new URLSearchParams(filtres.map(([k, v]) => [k, String(v)])).toString();
  const donnees = await apiFetch<{ resultats: UtilisateurAdmin[] } | UtilisateurAdmin[]>(
    `/identity/utilisateurs${chaine ? `?${chaine}` : ''}`,
  );
  return listeOuResultats(donnees);
}

export function creerUtilisateurAdmin(payload: NouvelUtilisateur) {
  return apiFetch<UtilisateurAdmin>('/identity/utilisateurs', { method: 'POST', corps: payload });
}

export function modifierUtilisateurAdmin(id: number, payload: Partial<NouvelUtilisateur>) {
  return apiFetch<UtilisateurAdmin>(`/identity/utilisateurs/${id}`, { method: 'PATCH', corps: payload });
}

export function desactiverUtilisateurAdmin(id: number) {
  return apiFetch<void>(`/identity/utilisateurs/${id}`, { method: 'DELETE' });
}

export async function listerApplicationsAdmin() {
  const donnees = await apiFetch<{ resultats: Application[] } | Application[]>('/identity/applications?active=true');
  return listeOuResultats(donnees);
}

export async function listerDepartementsAdmin() {
  const donnees = await apiFetch<{ resultats: Departement[] } | Departement[]>('/identity/departements?actif=true');
  return listeOuResultats(donnees);
}

export type DepartementEcriture = {
  code: string;
  nom: string;
  responsable?: number | null;
  ordre?: number;
  actif?: boolean;
};

export function creerDepartementAdmin(payload: DepartementEcriture) {
  return apiFetch<Departement>('/identity/departements', { method: 'POST', corps: payload });
}

export function modifierDepartementAdmin(id: number, payload: Partial<DepartementEcriture>) {
  return apiFetch<Departement>(`/identity/departements/${id}`, { method: 'PATCH', corps: payload });
}

export function creerHabilitation(payload: { utilisateur: number; application: number; roles: string[]; identifiant_local?: string }) {
  return apiFetch<Habilitation>('/identity/habilitations', { method: 'POST', corps: payload });
}

export function modifierHabilitation(id: number, payload: Partial<{ roles: string[]; active: boolean }>) {
  return apiFetch<Habilitation>(`/identity/habilitations/${id}`, { method: 'PATCH', corps: payload });
}
