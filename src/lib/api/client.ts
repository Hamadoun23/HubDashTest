/** Client HTTP vers le backend réel de GDA Hub (service `financerh`, exposé
 * sous `/api/...` par la passerelle nginx du dépôt GdaHub — voir
 * `docker-compose.yml` / `gateway/nginx.conf`). Un seul client pour toute
 * l'app : les jetons sont gérés ici, les modules `rh.ts` etc. n'appellent
 * que `apiFetch`. */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export class ApiError extends Error {
  statut: number;
  details: unknown;

  constructor(message: string, statut: number, details: unknown) {
    super(message);
    this.statut = statut;
    this.details = details;
  }
}

type Jetons = { access: string; refresh: string };

const CLE_STOCKAGE = 'gdahub_jetons';

export function lireJetonsStockes(): Jetons | null {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    return brut ? (JSON.parse(brut) as Jetons) : null;
  } catch {
    return null;
  }
}

function ecrireJetonsStockes(jetons: Jetons | null) {
  try {
    if (jetons) localStorage.setItem(CLE_STOCKAGE, JSON.stringify(jetons));
    else localStorage.removeItem(CLE_STOCKAGE);
  } catch {
    // Stockage indisponible (navigation privée...) : l'app reste utilisable pour la session en cours.
  }
}

let jetonsActuels: Jetons | null = lireJetonsStockes();
let rafraichissementEnCours: Promise<string> | null = null;

export function definirJetons(jetons: Jetons | null) {
  jetonsActuels = jetons;
  ecrireJetonsStockes(jetons);
}

export function jetonAcces(): string | null {
  return jetonsActuels?.access ?? null;
}

async function rafraichir(): Promise<string> {
  if (!jetonsActuels?.refresh) throw new ApiError('Session expirée', 401, null);

  // Jeton obtenu via `identity` (le hub) — c'est lui qui gère le rafraîchissement,
  // même pour les appels aux backends métier (financerh...), via le pont JWKS.
  const reponse = await fetch(`${BASE_URL}/identity/auth/rafraichir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rafraichissement: jetonsActuels.refresh }),
  });

  if (!reponse.ok) {
    definirJetons(null);
    throw new ApiError('Session expirée', 401, null);
  }

  const donnees = (await reponse.json()) as { acces: string; rafraichissement?: string };
  const nouveaux: Jetons = { access: donnees.acces, refresh: donnees.rafraichissement ?? jetonsActuels.refresh };
  definirJetons(nouveaux);
  return nouveaux.access;
}

type OptionsRequete = {
  method?: string;
  corps?: unknown;
  authentifie?: boolean;
  signal?: AbortSignal;
  /** En-têtes additionnels (ex. `X-Project-Id` pour le service chantiers). */
  entetes?: Record<string, string>;
};

/** Appelle l'API du hub (RH, jus d'orange, chantiers, planning...). `chemin` est relatif
 * à `/api` (ex. "/rh/demandes-absence/", "/chantiers/taches/").
 * Rafraîchit automatiquement le jeton d'accès une fois en cas de 401 avant d'abandonner. */
export async function apiFetch<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  const { method = 'GET', corps, authentifie = true, signal, entetes: entetesSupplementaires } = options;

  const executer = async (): Promise<Response> => {
    const entetes: Record<string, string> = { ...entetesSupplementaires };
    const estFormData = corps instanceof FormData;
    // Pour un FormData, ne pas fixer Content-Type : le navigateur doit poser lui-même
    // la frontière multipart, sinon le serveur ne peut pas parser le fichier envoyé.
    if (corps !== undefined && !estFormData) entetes['Content-Type'] = 'application/json';
    if (authentifie && jetonAcces()) entetes.Authorization = `Bearer ${jetonAcces()}`;

    return fetch(`${BASE_URL}${chemin}`, {
      method,
      headers: entetes,
      body: corps === undefined ? undefined : estFormData ? corps : JSON.stringify(corps),
      signal,
    });
  };

  let reponse = await executer();

  if (reponse.status === 401 && authentifie && jetonsActuels?.refresh) {
    try {
      rafraichissementEnCours ??= rafraichir().finally(() => {
        rafraichissementEnCours = null;
      });
      await rafraichissementEnCours;
      reponse = await executer();
    } catch {
      // Le rafraîchissement a échoué : on laisse la réponse 401 d'origine remonter ci-dessous.
    }
  }

  if (reponse.status === 204) return undefined as T;

  const texte = await reponse.text();
  const donnees = texte ? JSON.parse(texte) : null;

  if (!reponse.ok) {
    const message =
      donnees?.detail ?? donnees?.erreur?.message ?? (typeof donnees === 'object' ? JSON.stringify(donnees) : 'Erreur inconnue');
    throw new ApiError(message, reponse.status, donnees);
  }

  return donnees as T;
}
