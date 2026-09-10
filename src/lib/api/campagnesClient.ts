/** Client pour le service `campagnes` (alias interne « bdm ») — architecturellement
 * différent des autres services du hub : c'est un portage d'une ancienne
 * application Laravel/Inertia, pas une API DRF/JSON classique.
 *
 * - Authentification : cookie de session Django (`campagnes_sessionid`), pas de
 *   jeton porté par le client sur chaque appel. Un pont SSO (middleware
 *   `AuthentificationHub` côté service) ouvre cette session automatiquement dès
 *   qu'une requête sans session porte `Authorization: Bearer <jeton du hub>` —
 *   c'est ce qu'on envoie systématiquement ici ; le service l'ignore une fois la
 *   session déjà ouverte, donc l'envoyer à chaque appel est sans effet de bord.
 * - Protocole Inertia : une requête portant `X-Inertia: true` reçoit du JSON
 *   `{component, props, url, version}` au lieu de la page HTML complète — c'est
 *   ce qui permet de consommer ce service comme une pseudo-API JSON.
 * - Écritures : la plupart des actions (créer/modifier/supprimer une campagne...)
 *   répondent par une redirection 302/303 vers la page Inertia suivante plutôt
 *   que par un objet JSON de résultat. Comme le fetch par défaut (`redirect:
 *   'follow'`) réémet automatiquement les en-têtes sur une redirection de même
 *   origine, la réponse finale est déjà les props de la page d'arrivée — on
 *   n'a rien de spécial à faire tant que ce frontend est servi depuis la même
 *   origine que la passerelle (voir `VITE_CAMPAGNES_BASE_URL`).
 * - Deux endpoints sont de vraies routes JSON (`/api/ventes`, `/api/enrolements`) :
 *   on les utilise tels quels pour les écritures du terrain, plutôt que le
 *   protocole Inertia généraliste. */
import { jetonAcces } from './client';

const BASE = (import.meta.env.VITE_CAMPAGNES_BASE_URL as string | undefined) ?? '/campagnes';

export class CampagnesError extends Error {
  statut: number;
  details: unknown;
  constructor(message: string, statut: number, details: unknown) {
    super(message);
    this.statut = statut;
    this.details = details;
  }
}

function lireCookie(nom: string): string | null {
  const trouve = document.cookie.split('; ').find((c) => c.startsWith(`${nom}=`));
  return trouve ? decodeURIComponent(trouve.split('=').slice(1).join('=')) : null;
}

export type ReponseInertia<P> = { component: string; props: P; url: string; version: string };

type OptionsCampagnes = { method?: string; corps?: unknown };

/** Appelle une page Inertia du service campagnes et renvoie ses `props`. Utilisé
 * aussi bien pour la lecture (GET) que pour les écritures qui redirigent vers
 * une page Inertia (POST/PUT/DELETE hors `/api/...`). */
export async function campagnesFetch<P>(chemin: string, options: OptionsCampagnes = {}): Promise<ReponseInertia<P>> {
  const { method = 'GET', corps } = options;

  // Le cookie CSRF n'existe qu'après une première réponse qui l'a posé — une
  // requête d'écriture avant toute lecture ne l'aurait pas encore.
  if (method !== 'GET' && !lireCookie('campagnes_csrftoken')) {
    await campagnesFetch('/dashboard').catch(() => undefined);
  }

  const entetes: Record<string, string> = {
    'X-Inertia': 'true',
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json',
  };
  if (jetonAcces()) entetes.Authorization = `Bearer ${jetonAcces()}`;
  if (method !== 'GET') {
    const csrf = lireCookie('campagnes_csrftoken');
    if (csrf) entetes['X-CSRFToken'] = csrf;
    if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  }

  const reponse = await fetch(`${BASE}${chemin}`, {
    method,
    headers: entetes,
    credentials: 'include',
    body: corps !== undefined ? JSON.stringify(corps) : undefined,
  });

  if (!reponse.ok) {
    throw new CampagnesError(`Erreur ${reponse.status} sur ${chemin}`, reponse.status, null);
  }

  const donnees = (await reponse.json()) as ReponseInertia<P>;
  return donnees;
}

/** Appelle un des deux vrais endpoints JSON (`/api/ventes`, `/api/enrolements`).
 * `fichier` déclenche un envoi multipart (pièce d'identité jointe à une vente). */
export async function campagnesApiFetch<T>(
  chemin: string,
  corps: Record<string, unknown>,
  fichier?: { champ: string; valeur: File },
): Promise<T> {
  if (!lireCookie('campagnes_csrftoken')) {
    await campagnesFetch('/dashboard').catch(() => undefined);
  }

  const entetes: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' };
  if (jetonAcces()) entetes.Authorization = `Bearer ${jetonAcces()}`;
  const csrf = lireCookie('campagnes_csrftoken');
  if (csrf) entetes['X-CSRFToken'] = csrf;

  let corpsRequete: BodyInit;
  if (fichier) {
    const donnees = new FormData();
    Object.entries(corps).forEach(([cle, valeur]) => {
      if (valeur !== undefined && valeur !== null) donnees.append(cle, String(valeur));
    });
    donnees.append(fichier.champ, fichier.valeur);
    corpsRequete = donnees;
  } else {
    entetes['Content-Type'] = 'application/json';
    corpsRequete = JSON.stringify(corps);
  }

  const reponse = await fetch(`${BASE}${chemin}`, { method: 'POST', headers: entetes, credentials: 'include', body: corpsRequete });
  const donnees = await reponse.json();

  if (!reponse.ok || donnees?.success === false) {
    throw new CampagnesError(donnees?.message ?? `Erreur ${reponse.status}`, reponse.status, donnees);
  }
  return donnees as T;
}
