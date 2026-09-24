import type { Publication, Tournage } from '../../lib/api/planning';

export type EvenementAffiche = { type: 'tournage'; evenement: Tournage } | { type: 'publication'; evenement: Publication };

export function nomEvenement(item: EvenementAffiche): string {
  const { evenement } = item;
  if (evenement.description?.trim()) return evenement.description.trim();
  if (item.type === 'publication') return item.evenement.content_idea_detail?.titre || 'Sans titre';
  const idees = item.evenement.content_ideas_detail;
  return idees && idees.length > 0 ? idees.map((i) => i.titre).join(', ') : 'Sans titre';
}
