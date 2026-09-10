import { useOutletContext } from 'react-router-dom';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { listerTaches } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  termine: 'success',
  en_cours: 'warning',
  annule: 'danger',
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
          <ProgressBar progress={t.progress} height={5} />
        </div>,
        <Badge tone={TONE[t.status] ?? 'neutral'}>{t.status_label}</Badge>,
      ])}
    />
  );
}
