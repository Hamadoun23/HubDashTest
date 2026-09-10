/** Authentification via le service `identity` (`/api/identity/auth/...`) —
 * le vrai point d'entrée du hub : un compte unique, qui renvoie la liste des
 * applications auxquelles l'utilisateur a accès. Le jeton d'accès obtenu ici
 * (RS256) est aussi accepté par les backends métier (financerh, jusorange...)
 * via le pont JWKS — voir rapport d'exploration, `AuthentificationHub`. */
import { apiFetch, definirJetons } from './client';

export type Application = {
  id: number;
  code: string;
  nom: string;
  description: string;
  groupe: string;
  chemin: string;
  prefixe_api: string;
  roles_disponibles: string[];
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
