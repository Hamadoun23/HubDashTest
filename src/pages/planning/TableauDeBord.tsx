import { AlertTriangle, Clapperboard, Lightbulb, Megaphone, Users, Video } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { Badge } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import {
  LIBELLES_STATUT,
  listerClients,
  listerIdees,
  tableauDeBord,
  type Publication,
  type StatutEvenement,
  type Tournage,
} from '../../lib/api/planning';
import { CalendrierPlanning } from './CalendrierPlanning';

const maintenant = new Date();

const TONE: Record<StatutEvenement, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  not_realized: 'danger',
  cancelled: 'neutral',
  rescheduled: 'warning',
};

type EvenementAffiche =
  | { type: 'tournage'; evenement: Tournage }
  | { type: 'publication'; evenement: Publication };

function trierParDate(evenements: EvenementAffiche[]) {
  return [...evenements].sort(
    (a, b) => new Date(a.evenement.date).getTime() - new Date(b.evenement.date).getTime(),
  );
}

function LigneEvenement({ item, enRetard }: { item: EvenementAffiche; enRetard?: boolean }) {
  const { evenement } = item;
  const Icon = item.type === 'tournage' ? Video : Megaphone;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
        enRetard ? 'border-red-500/30 bg-red-500/10' : 'border-border bg-surface2'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: enRetard ? '#f8717126' : '#ff8a4c26' }}
        >
          <Icon size={14} color={enRetard ? '#f87171' : '#ff8a4c'} />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">{evenement.client_nom}</p>
          <p className="text-xs text-muted">
            {item.type === 'tournage' ? 'Tournage' : 'Publication'} ·{' '}
            {new Date(evenement.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
      <Badge tone={enRetard ? 'danger' : TONE[evenement.status]}>{LIBELLES_STATUT[evenement.status]}</Badge>
    </div>
  );
}

export default function TableauDeBordPlanning() {
  const clients = useApi(listerClients, []);
  const idees = useApi(listerIdees, []);
  const bord = useApi(() => tableauDeBord(maintenant.getMonth() + 1, maintenant.getFullYear()), []);

  const donnees = bord.donnees;
  const enRetard: EvenementAffiche[] = trierParDate([
    ...(donnees?.tournages_en_retard.map((t) => ({ type: 'tournage' as const, evenement: t })) ?? []),
    ...(donnees?.publications_en_retard.map((p) => ({ type: 'publication' as const, evenement: p })) ?? []),
  ]);
  const aVenir: EvenementAffiche[] = trierParDate([
    ...(donnees?.tournages_a_venir.map((t) => ({ type: 'tournage' as const, evenement: t })) ?? []),
    ...(donnees?.publications_a_venir.map((p) => ({ type: 'publication' as const, evenement: p })) ?? []),
  ]);
  const totalRetard = enRetard.length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={Clapperboard} titre="Planning" sousTitre="Gérez vos plannings et générez des rapports en un clic" />
      <div className={`grid gap-4 ${totalRetard > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <StatTile icon={Users} valeur={clients.donnees?.length ?? '—'} libelle="Clients suivis" teinte="#60a5fa" />
        <StatTile
          icon={Video}
          valeur={bord.donnees?.stats.shootings_this_month ?? '—'}
          libelle="Tournages ce mois"
          teinte="#ff8a4c"
        />
        <StatTile icon={Lightbulb} valeur={idees.donnees?.length ?? '—'} libelle="Idées en cours" teinte="#facc15" />
        {totalRetard > 0 && (
          <StatTile icon={AlertTriangle} valeur={totalRetard} libelle="En retard" teinte="#f87171" />
        )}
      </div>

      {donnees && (
        <Card>
          <h2 className="text-sm font-bold text-white">Activité récente</h2>
          <div className="mt-4 flex flex-col gap-2">
            {enRetard.length === 0 && aVenir.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Aucun tournage ni publication en retard ou à venir.</p>
            ) : (
              <>
                {enRetard.slice(0, 5).map((item) => (
                  <LigneEvenement key={`retard-${item.type}-${item.evenement.id}`} item={item} enRetard />
                ))}
                {aVenir.slice(0, 8).map((item) => (
                  <LigneEvenement key={`avenir-${item.type}-${item.evenement.id}`} item={item} />
                ))}
              </>
            )}
          </div>
        </Card>
      )}

      <CalendrierPlanning />
    </div>
  );
}
