import { useState } from 'react';
import { ArrowLeft, Megaphone, Pencil, Trash2, Video, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Table';
import { useAction } from '../../lib/hooks/useApi';
import {
  LIBELLES_STATUT,
  changerStatutPublication,
  changerStatutTournage,
  reprogrammerPublication,
  reprogrammerTournage,
  supprimerPublication,
  supprimerTournage,
  type JourCalendrier,
  type StatutEvenement,
} from '../../lib/api/planning';
import { nomEvenement, type EvenementAffiche } from './evenementUtils';
import { BoutonReprogrammer, SelecteurStatut } from './SelecteurStatut';

const TONE: Record<StatutEvenement, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  not_realized: 'danger',
  cancelled: 'neutral',
  rescheduled: 'warning',
};

/** Vue détail d'un seul événement (Voir) — statut, reprogrammation, modifier,
 * supprimer. Réutilisée par `ModaleJour` (clic sur un événement du jour) et
 * par les listes "Prochains tournages/publications" du tableau de bord. */
export function DetailEvenementModale({
  item,
  onFermer,
  onChange,
  onRetour,
}: {
  item: EvenementAffiche;
  onFermer: () => void;
  onChange: () => void;
  onRetour?: () => void;
}) {
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const navigate = useNavigate();
  const statutTournage = useAction(changerStatutTournage);
  const statutPublication = useAction(changerStatutPublication);
  const reproTournage = useAction(reprogrammerTournage);
  const reproPublication = useAction(reprogrammerPublication);

  function modifier() {
    navigate(item.type === 'tournage' ? `/planning/tournages?edit=${item.evenement.id}` : `/planning/publications?edit=${item.evenement.id}`);
  }

  async function supprimer() {
    if (!confirm('Supprimer cet événement ?')) return;
    setSuppressionEnCours(true);
    try {
      if (item.type === 'tournage') await supprimerTournage(item.evenement.id);
      else await supprimerPublication(item.evenement.id);
      onFermer();
      onChange();
    } finally {
      setSuppressionEnCours(false);
    }
  }

  const { evenement, type } = item;
  const Icon = type === 'tournage' ? Video : Megaphone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto !bg-surface">
        <div className="mb-4 flex items-center justify-between">
          {onRetour ? (
            <button onClick={onRetour} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white">
              <ArrowLeft size={14} /> Retour
            </button>
          ) : (
            <span />
          )}
          <button onClick={onFermer} className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <Icon size={18} className="text-accent2" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">{type === 'tournage' ? 'Tournage' : 'Publication'}</h2>
            <p className="truncate text-sm text-muted">{nomEvenement(item)}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <Badge tone="neutral">{new Date(evenement.date).toLocaleString('fr-FR')}</Badge>
          <Badge tone="neutral">{evenement.client_nom}</Badge>
          <Badge tone={TONE[evenement.status]}>{LIBELLES_STATUT[evenement.status]}</Badge>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface2 p-3 text-xs">
          {evenement.description && (
            <p>
              <span className="font-semibold text-muted">Description : </span>
              <span className="text-white">{evenement.description}</span>
            </p>
          )}
          {type === 'tournage' && evenement.content_ideas_detail.length > 0 && (
            <p>
              <span className="font-semibold text-muted">Idées de contenu : </span>
              <span className="text-white">{evenement.content_ideas_detail.map((i) => i.titre).join(', ')}</span>
            </p>
          )}
          {type === 'publication' && evenement.content_idea_detail && (
            <p>
              <span className="font-semibold text-muted">Idée de contenu : </span>
              <span className="text-white">{evenement.content_idea_detail.titre}</span>
            </p>
          )}
          {type === 'publication' && evenement.shooting_date && (
            <p>
              <span className="font-semibold text-muted">Tournage lié : </span>
              <span className="text-white">{new Date(evenement.shooting_date).toLocaleDateString('fr-FR')}</span>
            </p>
          )}
          {evenement.status_reason && (
            <p>
              <span className="font-semibold text-muted">Motif : </span>
              <span className="text-white">{evenement.status_reason}</span>
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Statut :</span>
          {type === 'tournage' ? (
            <SelecteurStatut
              statutActuel={evenement.status}
              enCours={statutTournage.enCours}
              onChanger={(valeur, raison, rescheduleDate) =>
                changerStatutTournage(evenement.id, valeur, raison, rescheduleDate).then(() => onChange())
              }
            />
          ) : (
            <SelecteurStatut
              statutActuel={evenement.status}
              enCours={statutPublication.enCours}
              onChanger={(valeur, raison, rescheduleDate) =>
                changerStatutPublication(evenement.id, valeur, raison, rescheduleDate).then(() => onChange())
              }
            />
          )}
          {type === 'tournage' ? (
            <BoutonReprogrammer enCours={reproTournage.enCours} onReprogrammer={(d) => reprogrammerTournage(evenement.id, d).then(() => onChange())} />
          ) : (
            <BoutonReprogrammer enCours={reproPublication.enCours} onReprogrammer={(d) => reprogrammerPublication(evenement.id, d).then(() => onChange())} />
          )}
        </div>

        <div className="mt-4 flex justify-between border-t border-border pt-3">
          <button onClick={modifier} className="flex items-center gap-1.5 rounded-xl border border-border bg-surface2 px-3 py-2 text-xs font-bold text-white">
            <Pencil size={13} /> Modifier
          </button>
          <button
            onClick={supprimer}
            disabled={suppressionEnCours}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 disabled:opacity-50"
          >
            <Trash2 size={13} /> Supprimer
          </button>
        </div>
      </Card>
    </div>
  );
}

/** Modale "Événements du {jour}" — équivalent de la modale de jour de l'app
 * Laravel d'origine : liste des tournages/publications du jour, chaque ligne
 * ouvrant la vue détail (Voir/Modifier/Supprimer) ci-dessus. */
export function ModaleJour({
  jour,
  onFermer,
  onChange,
  afficherClient = true,
}: {
  jour: JourCalendrier;
  onFermer: () => void;
  onChange: () => void;
  afficherClient?: boolean;
}) {
  const [selection, setSelection] = useState<EvenementAffiche | null>(null);

  const dateLibelle = new Date(jour.date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (selection) {
    return (
      <DetailEvenementModale item={selection} onFermer={onFermer} onChange={onChange} onRetour={() => setSelection(null)} />
    );
  }

  const evenements: EvenementAffiche[] = [
    ...jour.tournages.map((t) => ({ type: 'tournage' as const, evenement: t })),
    ...jour.publications.map((p) => ({ type: 'publication' as const, evenement: p })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto !bg-surface">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold capitalize text-white">Événements du {dateLibelle}</h2>
          <button onClick={onFermer} className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {evenements.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface2 p-4 text-center text-xs text-muted">Aucun événement ce jour-là.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {evenements.map((item) => {
              const Icon = item.type === 'tournage' ? Video : Megaphone;
              return (
                <button
                  key={`${item.type}-${item.evenement.id}`}
                  onClick={() => setSelection(item)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface2 p-3 text-left hover:border-accent/40"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Icon size={15} className="shrink-0 text-accent2" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{nomEvenement(item)}</p>
                      {afficherClient && <p className="truncate text-[11px] text-muted">{item.evenement.client_nom}</p>}
                    </div>
                  </div>
                  <Badge tone={TONE[item.evenement.status]}>{LIBELLES_STATUT[item.evenement.status]}</Badge>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
