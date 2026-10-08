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
  /** Libellé du bouton qui mène au traitement. */
  action: string;
  gravite: 'haute' | 'normale';
  /** De quoi il s'agit et quoi faire, en clair (fenêtre « Voir les détails »). */
  explication: string;
  /** Éléments concernés, ligne par ligne. */
  elements?: { libelle: string; valeur: string }[];
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
      action: 'Ouvrir le dossier',
      gravite: d.categorie === 'RETARD' || d.categorie === 'PERMISSION' ? 'haute' : 'normale',
      explication: `${d.demandeur_nom} a fait une demande (${d.type_absence_libelle}) qui attend votre avis ou votre décision.`,
      elements: [
        { libelle: 'Référence', valeur: d.numero },
        { libelle: 'Période', valeur: d.date_debut === d.date_fin ? d.date_debut : `${d.date_debut} → ${d.date_fin}` },
        { libelle: 'Étape', valeur: d.etape_courante_libelle || '—' },
      ],
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
      action: 'Ouvrir le dossier',
      gravite: 'normale',
      explication: `${r.demandeur_nom} a fait une réquisition qui attend votre avis ou votre décision.`,
      elements: [{ libelle: 'Référence', valeur: r.numero }, { libelle: 'Objet', valeur: r.objet }],
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
      action: 'Répondre au valideur',
      gravite: 'haute',
      explication: 'Un valideur a mis votre demande en attente : il vous demande un complément. Répondez-lui dans le fil du dossier ou corrigez votre demande.',
      elements: [{ libelle: 'Demande', valeur: `${d.type_absence_libelle} · ${d.numero}` }],
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
      action: 'Voir le stock',
      gravite: 'haute',
      explication:
        "Le stock de ces articles est descendu sous leur seuil d'alerte. Il faut les réapprovisionner (Réceptions), ou ajuster le seuil s'il n'est plus adapté (Articles / Stock).",
      elements: sousSeuil.map((x) => ({ libelle: x.article, valeur: `stock ${x.stock} — seuil ${x.seuil}` })),
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
        action: 'Ouvrir le chantier',
        gravite: 'haute',
        explication: "La date de fin prévue de ce chantier est dépassée alors qu'il n'est pas terminé. Mettez à jour l'avancement ou la date de fin.",
        elements: [
          { libelle: 'Chantier', valeur: p.name },
          { libelle: 'Fin prévue', valeur: p.end_date ?? '—' },
          { libelle: 'Avancement', valeur: `${Math.round(p.overall_progress ?? 0)} %` },
        ],
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
      action: 'Voir les publications',
      gravite: 'normale',
      explication: "Ces publications sont passées sans être marquées comme faites. Mettez à jour leur statut (publiée, reprogrammée ou annulée).",
      elements: a.publications_en_retard.slice(0, 6).map((x) => ({ libelle: x.client_nom, valeur: new Date(x.date).toLocaleDateString('fr-FR') })),
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
      action: 'Voir les tournages',
      gravite: 'normale',
      explication: "Ces tournages sont passés sans être marqués comme faits. Mettez à jour leur statut (réalisé, reprogrammé ou annulé).",
      elements: a.tournages_en_retard.slice(0, 6).map((x) => ({ libelle: x.client_nom, valeur: new Date(x.date).toLocaleDateString('fr-FR') })),
    });
  }

  liste.sort((x, y) => (x.gravite === y.gravite ? 0 : x.gravite === 'haute' ? -1 : 1));
  const chargement = absences.chargement || requisitions.chargement || miennes.chargement || resumeJus.chargement || projets.chargement || agenda.chargement;
  const parApp = liste.reduce<Partial<Record<AppKey, number>>>((acc, u) => ({ ...acc, [u.app]: (acc[u.app] ?? 0) + 1 }), {});
  return { urgences: liste, hautes: liste.filter((u) => u.gravite === 'haute'), parApp, chargement, projets: projets.donnees ?? [] };
}
