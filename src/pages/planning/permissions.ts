import { useAuth } from '../../lib/auth/AuthContext';

/** Miroir exact de `UtilisateurHub` côté backend (`backend/planning/planning/hub.py`) :
 * admin/team l'emportent toujours sur client si les deux sont présents par erreur. */
export function usePermissionsPlanning() {
  const { habilitations } = useAuth();
  const roles = habilitations.planning ?? [];
  const estAdmin = roles.includes('admin');
  const estTeam = roles.includes('team') && !estAdmin;
  const estClient = roles.includes('client') && !estAdmin && !roles.includes('team');
  return {
    roles,
    estAdmin,
    estTeam,
    estClient,
    /** Team et client sont lecture seule ; seul admin écrit (`EcritureReserveeAAdmin` côté backend). */
    peutEcrire: estAdmin,
  };
}
