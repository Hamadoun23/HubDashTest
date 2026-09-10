/** Profil RH/Finance (`/api/auth/profil/`, service `financerh`). La connexion
 * elle-même passe par `identity` (voir `identity.ts`) — le jeton du hub est
 * accepté ici via le pont JWKS, donc pas de connexion séparée à financerh :
 * seul ce profil enrichi (poste, département, solde...) est encore appelé
 * directement sur ce service. */
import { apiFetch, definirJetons } from './client';

export type Utilisateur = {
  id: number;
  username: string;
  matricule: string;
  first_name: string;
  last_name: string;
  nom_complet: string;
  email: string;
  telephone: string;
  role: 'SALARIE' | 'RH' | 'FINANCE' | 'DIRECTION';
  role_libelle: string;
  poste: string;
  departement: number | null;
  departement_nom: string;
  manager: number | null;
  manager_nom: string;
  type_contrat: string;
  date_embauche: string | null;
  date_sortie: string | null;
  motif_sortie: string;
  anciennete_mois: number;
  est_encadrant: boolean;
  is_active: boolean;
};

export async function deconnexion() {
  definirJetons(null);
}

export function obtenirProfil() {
  return apiFetch<Utilisateur>('/auth/profil/');
}

export function modifierProfil(champs: Partial<Pick<Utilisateur, 'telephone' | 'email'>>) {
  return apiFetch<Utilisateur>('/auth/profil/', { method: 'PATCH', corps: champs });
}

export function changerMotDePasse(ancien_mot_de_passe: string, nouveau_mot_de_passe: string) {
  return apiFetch<{ detail: string }>('/auth/mot-de-passe/', {
    method: 'POST',
    corps: { ancien_mot_de_passe, nouveau_mot_de_passe },
  });
}
