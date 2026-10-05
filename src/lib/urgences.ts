import { useAuth } from './auth/AuthContext';
import { useApi } from './hooks/useApi';
import { demandesAValider, mesDemandes } from './api/rh';
import { requisitionsAValider } from './api/finance';
import { obtenirSummary } from './api/jus';
import { listerProjets } from './api/chantiers';
import { tableauDeBord } from './api/planning';
import type { AppKey } from './navigation';

/**
 * Ce qui demande l'attention de la personne connectée, toutes applis
 * confondues : une seule liste, triée par gravité, qui alimente les blocs
 * de l'accueil (suivi des tâches, priorité, « À traiter »). Chaque appli
 * n'est interrogée que si la personne y a accès ; une appli indisponible
 * n'empêche pas les autres de remonter leurs urgences.
 */
export type Urgence = {
  cle: string;
  app: AppKey;
  titre: string;
  detail: string;
  /** Personne concernée (demandeur) ou, à défaut, nom de l'appli pour l'avatar. */
  personne: string;
  /** Pour retrouver la photo de profil de la personne. */
  email?: string;
  lien: string;
  gravite: 'haute' | 'normale';
};

export const NOM_APP: Record<AppKey, string> = {
  hub: 'GDA Hub',
  rh: 'RH & Finance',
  jus: "Jus d'orange",
  chantiers: 'Chantiers',
  planning: 'Planning',
  campagnes: 'Campagnes',
};

const AUJOURDHUI = new Date();
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function useUrgences() {
  const { applications } = useAuth();
  const acces = (prefixe: string) => applications.some((a) => a.active !== false && a.chemin.startsWith(prefixe));
  const rh = acces('/rh');
  const jus = acces('/jus');
  const chantiers = acces('/chantiers');
  const planning = acces('/planning');

  const absences = useApi(() => (rh ? demandesAValider() : Promise.resolve([])), [rh]);
  const requisitions = useApi(() => (rh ? requisitionsAValider() : Promise.resolve([])), [rh]);
  const miennes = useApi(() => (rh ? mesDemandes() : Promise.resolve([])), [rh]);
  const resumeJus = useApi(() => (jus ? obtenirSummary().catch(() => null) : Promise.resolve(null)), [jus]);
  const projets = useApi(() => (chantiers ? listerProjets().catch(() => []) : Promise.resolve([])), [chantiers]);
  const agenda = useApi(
    () => (planning ? tableauDeBord(AUJOURDHUI.getMonth() + 1, AUJOURDHUI.getFullYear()).catch(() => null) : Promise.resolve(null)),
    [planning],
  );

  const liste: Urgence[] = [];

  // RH & Finance : dossiers qui attendent ma décision.
  for (const d of absences.donnees ?? []) {
    liste.push({
      cle: `absence-${d.id}`,
      app: 'rh',
      titre: d.type_absence_libelle,
      detail: `${d.demandeur_nom} · ${d.numero}`,
      personne: d.demandeur_nom,
      email: d.demandeur_email,
      lien: `/rh/dossiers/absence/${d.id}`,
      gravite: d.categorie === 'RETARD' || d.categorie === 'PERMISSION' ? 'haute' : 'normale',
    });
  }
  for (const r of requisitions.donnees ?? []) {
    liste.push({
      cle: `requisition-${r.id}`,
      app: 'rh',
      titre: `Réquisition — ${r.objet}`,
      detail: `${r.demandeur_nom} · ${r.numero}`,
      personne: r.demandeur_nom,
      email: r.demandeur_email,
      lien: `/rh/dossiers/requisition/${r.id}`,
      gravite: 'normale',
    });
  }
  // Mes demandes mises en attente : un valideur attend ma réponse.
  for (const d of (miennes.donnees ?? []).filter((x) => x.en_attente)) {
    liste.push({
      cle: `complement-${d.id}`,
      app: 'rh',
      titre: 'Complément demandé',
      detail: `${d.type_absence_libelle} · ${d.numero}`,
      personne: NOM_APP.rh,
      lien: `/rh/dossiers/absence/${d.id}`,
      gravite: 'haute',
    });
  }

  // Jus d'orange : stock sous le seuil d'alerte.
  const sousSeuil = (resumeJus.donnees?.stock_articles ?? []).filter((a) => a.stock < a.seuil);
  if (sousSeuil.length > 0) {
    liste.push({
      cle: 'jus-stock',
      app: 'jus',
      titre: `${pluriel(sousSeuil.length, 'article')} sous le seuil`,
      detail: sousSeuil
        .slice(0, 3)
        .map((a) => a.article)
        .join(', '),
      personne: NOM_APP.jus,
      lien: '/jus/production/articles',
      gravite: 'haute',
    });
  }

  // Chantiers : date de fin dépassée sans être terminé.
  for (const p of projets.donnees ?? []) {
    if (p.status === 'termine' || !p.end_date) continue;
    if (new Date(p.end_date) < AUJOURDHUI && (p.overall_progress ?? 0) < 100) {
      liste.push({
        cle: `chantier-${p.id}`,
        app: 'chantiers',
        titre: 'Chantier en retard',
        detail: `${p.name} · ${Math.round(p.overall_progress ?? 0)} %`,
        personne: NOM_APP.chantiers,
        lien: `/chantiers/${p.id}`,
        gravite: 'haute',
      });
    }
  }

  // Planning : publications et tournages passés sans être faits.
  const a = agenda.donnees;
  if (a && a.publications_en_retard.length > 0) {
    liste.push({
      cle: 'planning-publications',
      app: 'planning',
      titre: `${pluriel(a.publications_en_retard.length, 'publication')} en retard`,
      detail: a.publications_en_retard[0]?.client_nom ? `Dont ${a.publications_en_retard[0].client_nom}` : 'Statut à mettre à jour',
      personne: NOM_APP.planning,
      lien: '/planning/publications',
      gravite: 'normale',
    });
  }
  if (a && a.tournages_en_retard.length > 0) {
    liste.push({
      cle: 'planning-tournages',
      app: 'planning',
      titre: `${pluriel(a.tournages_en_retard.length, 'tournage')} en retard`,
      detail: a.tournages_en_retard[0]?.client_nom ? `Dont ${a.tournages_en_retard[0].client_nom}` : 'Statut à mettre à jour',
      personne: NOM_APP.planning,
      lien: '/planning/tournages',
      gravite: 'normale',
    });
  }

  liste.sort((x, y) => (x.gravite === y.gravite ? 0 : x.gravite === 'haute' ? -1 : 1));
  const chargement = absences.chargement || requisitions.chargement || miennes.chargement || resumeJus.chargement || projets.chargement || agenda.chargement;
  const parApp = liste.reduce<Partial<Record<AppKey, number>>>((acc, u) => ({ ...acc, [u.app]: (acc[u.app] ?? 0) + 1 }), {});
  return { urgences: liste, hautes: liste.filter((u) => u.gravite === 'haute'), parApp, chargement, projets: projets.donnees ?? [] };
}
