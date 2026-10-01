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
