import { useAuth } from './AuthContext';

/** Rôles de Campagnes tenus par des commerciaux externes à GDA. */
const ROLES_EXTERNES = ['commercial', 'commercial_telephonique'];

/**
 * Un commercial de Campagnes (BDM, UBA…) est externe à GDA : il ne doit rien
 * voir du hub. Il se connecte, arrive sur son tableau de bord Campagnes, signe
 * son contrat et saisit ses ventes — ni accueil du hub, ni lanceur
 * d'applications, ni retour « GDA Hub ».
 *
 * Est externe un compte dont la seule habilitation est Campagnes, avec
 * uniquement des rôles de commercial. Un agent de GDA qui a aussi accès à une
 * autre application, ou un super-administrateur, garde le hub.
 */
export function estCommercialExterne(
  habilitations: Record<string, string[]>,
  estSuperadmin: boolean | undefined,
): boolean {
  if (estSuperadmin) return false;
  const applications = Object.keys(habilitations);
  if (applications.length !== 1 || applications[0] !== 'campagnes') return false;
  const roles = habilitations.campagnes ?? [];
  return roles.length > 0 && roles.every((r) => ROLES_EXTERNES.includes(r));
}

export function useCommercialExterne(): boolean {
  const { habilitations, identite } = useAuth();
  return estCommercialExterne(habilitations, identite?.est_superadmin);
}

/**
 * Espace d'un compte externe à GDA, ou `null` pour un collaborateur.
 *
 * - commercial Campagnes (BDM, UBA…) → `/campagnes` ;
 * - partenaire Chantiers (B2Gold…), seule habilitation « daily » en rôle
 *   partenaire → `/chantiers`, en lecture seule sur ses propres chantiers.
 *
 * Ces comptes ne voient ni l'accueil du hub, ni les autres applications.
 */
export function espaceExterne(
  habilitations: Record<string, string[]>,
  estSuperadmin: boolean | undefined,
): '/campagnes' | '/chantiers' | null {
  if (estSuperadmin) return null;
  if (estCommercialExterne(habilitations, estSuperadmin)) return '/campagnes';
  const applications = Object.keys(habilitations);
  const roles = habilitations.daily ?? [];
  if (applications.length === 1 && applications[0] === 'daily' && roles.length > 0 && roles.every((r) => r === 'partenaire')) {
    return '/chantiers';
  }
  return null;
}

export function useEspaceExterne() {
  const { habilitations, identite } = useAuth();
  return espaceExterne(habilitations, identite?.est_superadmin);
}
