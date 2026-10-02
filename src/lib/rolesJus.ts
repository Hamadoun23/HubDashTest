// Miroir de `api/permissions.py` côté jusorange : qui a le droit d'écrire ou
// de lire chaque domaine (`rw(read=…, write=…)`). Finance lit Production et
// Commercial (pas seulement Finance/Reporting) ; Direction lit tout. Sans ce
// filtre, tout le monde voyait les cinq sections quel que soit son groupe
// réel — jamais remarqué car on ne testait qu'avec un compte superuser (qui
// reçoit aussi les quatre rôles, voir `_user_payload`).
export const ROLES_PAR_SECTION: Record<string, string[]> = {
  'orange-direction': ['Direction', 'Finance'],
  'orange-production': ['ResProd', 'Finance', 'Direction'],
  'orange-commercial': ['Commercial', 'Finance', 'Direction'],
  'orange-finance': ['Finance', 'Direction'],
  'orange-reporting': ['ResProd', 'Commercial', 'Finance', 'Direction'],
};

// Exceptions plus étroites que le reste de leur section — miroir exact de
// `IsDirection` (Utilisateurs) et de `ROLES_RAPPORT` (chaque rapport n'est
// pas ouvert à tous ceux qui voient l'onglet Reporting : Distribution est
// fermé à la production, les 5 autres sont fermés au commercial).
export const ROLES_PAR_HREF: Record<string, string[]> = {
  '/jus/direction/utilisateurs': ['Direction'],
  '/jus/reporting/recolte': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/appro': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/fabrication': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/emballage': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/entrepot': ['ResProd', 'Finance', 'Direction'],
  '/jus/reporting/distribution': ['Commercial', 'Finance', 'Direction'],
};

export function itemJusVisible(sectionKey: string, href: string, roles: string[]) {
  const requis = ROLES_PAR_HREF[href] ?? ROLES_PAR_SECTION[sectionKey];
  if (!requis) return true;
  return requis.some((role) => roles.includes(role));
}

/**
 * Groupes Jus d'une habilitation du hub, quand le profil Jus n'est pas encore
 * chargé (navigation entre applis) : même correspondance que
 * `jusorange/accounts/hub.py`.
 */
export function rolesJusDepuisHub(roles: string[], estSuperadmin: boolean): string[] {
  if (estSuperadmin || roles.includes('admin')) return ['Direction', 'Finance', 'Commercial', 'ResProd'];
  const correspondance: Record<string, string> = {
    direction: 'Direction',
    finance: 'Finance',
    commercial: 'Commercial',
    responsable_production: 'ResProd',
  };
  return roles.map((r) => correspondance[r]).filter(Boolean);
}
