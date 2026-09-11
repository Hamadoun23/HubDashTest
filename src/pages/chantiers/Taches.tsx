import { useOutletContext } from 'react-router-dom';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { ProgressBar } from '../../components/ui-light/ProgressBar';
import { TableVirtus } from '../../components/ui-light/Table';
import { useApi } from '../../lib/hooks/useApi';
import { listerTaches } from '../../lib/api/chantiers';
import { StatutBadge, type ContexteChantier } from './ChantierLayout';

const TONE: Record<string, 'vert' | 'bleu' | 'rouge' | 'neutre'> = {
  termine: 'vert',
  en_cours: 'bleu',
  annule: 'rouge',
};

export default function Taches() {
  const { projet } = useOutletContext<ContexteChantier>();
  const taches = useApi(() => listerTaches(projet.id), [projet.id]);

  if (taches.chargement) return <EtatChargement texte="Chargement des tâches…" />;
  if (taches.erreur) return <EtatErreur message={taches.erreur} recharger={taches.recharger} />;

  return (
    <TableVirtus
      colonnes={['Phase', 'Sous-phase', 'Activité', 'Avancement', 'Statut']}
      lignes={(taches.donnees ?? []).map((t) => [
        t.phase,
        t.subphase,
        t.activity,
        <div className="w-28">
          <ProgressBar progress={t.progress} height={5} accent="#c8521a" />
        </div>,
        <StatutBadge ton={TONE[t.status] ?? 'neutre'}>{t.status_label}</StatutBadge>,
      ])}
    />
  );
}
