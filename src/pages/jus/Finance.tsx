import { Clock, Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirRapprochement } from '../../lib/api/jus';

const TONE = { CONFORME: 'success', ECART_POSITIF: 'warning', ECART_NEGATIF: 'danger', EN_ATTENTE: 'neutral' } as const;

export default function Finance() {
  const rapprochement = useApi(obtenirRapprochement, []);

  if (rapprochement.chargement) return <EtatChargement texte="Chargement…" />;
  if (rapprochement.erreur || !rapprochement.donnees) {
    return <EtatErreur message={rapprochement.erreur ?? 'Indisponible'} recharger={rapprochement.recharger} />;
  }

  const { totaux, lignes } = rapprochement.donnees;
  const tauxRapprochement = totaux.total_commercial > 0 ? (totaux.total_recu / totaux.total_commercial) * 100 : 0;
  const dernieresOperations = [...lignes]
    .sort((a, b) => b.date_paie.localeCompare(a.date_paie))
    .slice(0, 8);

  return (
    <div>
      <PageHeader icon={Landmark} titre="Jus d'orange — Finance" sousTitre="Vue d'ensemble financière" />
      <div className="mb-4 grid grid-cols-4 gap-4">
        <StatTile icon={Wallet} valeur={`${totaux.total_commercial} F`} libelle="Facturé (commercial)" teinte="#60a5fa" />
        <StatTile icon={TrendingUp} valeur={`${totaux.total_recu} F`} libelle="Reçu (trésorerie)" teinte="#34d399" />
        <StatTile icon={TrendingDown} valeur={`${totaux.ecart_global} F`} libelle="Écart global" teinte="#f87171" />
        <StatTile icon={Clock} valeur={totaux.nb_en_attente} libelle="En attente de rapprochement" teinte="#ff8a4c" />
      </div>

      <Card className="mb-4 flex items-center gap-4">
        <CircularProgress progress={tauxRapprochement} size={64} strokeWidth={6} gradientId="jus-finance-rapprochement-gradient" />
        <div>
          <p className="text-sm font-semibold text-white">{Math.round(tauxRapprochement)}% du facturé effectivement reçu</p>
          <p className="text-xs text-muted">{totaux.nb_ecarts_non_traites} écart(s) non traité(s)</p>
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Dernières opérations de trésorerie</h2>
        <Link to="/jus/finance/tresorerie" className="text-xs font-semibold text-accent2">
          Voir le détail →
        </Link>
      </div>
      <TableVirtus
        colonnes={['Client', 'Facture', 'Commercial', 'Reçu', 'Statut']}
        lignes={dernieresOperations.map((l) => [
          l.client_nom,
          l.num_fact,
          `${l.montant_commercial} F`,
          l.montant_recu !== null ? `${l.montant_recu} F` : '—',
          <Badge tone={TONE[l.statut_reception]}>{l.statut_reception === 'EN_ATTENTE' ? 'En attente' : l.statut_reception.replace('_', ' ')}</Badge>,
        ])}
      />
    </div>
  );
}
