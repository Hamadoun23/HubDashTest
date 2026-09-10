import { ReceiptText, ShoppingCart, Users, Wallet } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { listerVentes, obtenirSummary } from '../../lib/api/jus';

const TONE = { ACHAT_VENTE: 'success', PARTIELLE: 'warning', DEPOT_VENTE: 'neutral' } as const;

export default function Commercial() {
  const summary = useApi(obtenirSummary, []);
  const ventes = useApi(() => listerVentes(), []);

  if (summary.chargement || ventes.chargement) return <EtatChargement texte="Chargement…" />;
  if (summary.erreur || !summary.donnees) return <EtatErreur message={summary.erreur ?? 'Indisponible'} recharger={summary.recharger} />;
  if (ventes.erreur) return <EtatErreur message={ventes.erreur} recharger={ventes.recharger} />;

  const { kpi } = summary.donnees;
  const listeVentes = ventes.donnees ?? [];
  const resteAPayer = listeVentes.reduce((s, v) => s + v.reste_a_payer, 0);
  const totalFacture = listeVentes.reduce((s, v) => s + v.montant_total, 0);
  const totalPaye = listeVentes.reduce((s, v) => s + v.total_paye, 0);
  const tauxEncaissement = totalFacture > 0 ? (totalPaye / totalFacture) * 100 : 0;

  return (
    <div>
      <PageHeader icon={ShoppingCart} titre="Jus d'orange — Commercial" sousTitre="Prospection, clients, ventes" />

      <div className="mb-4 grid grid-cols-4 gap-4">
        <StatTile icon={Users} valeur={kpi.clients} libelle="Clients" teinte="#60a5fa" />
        <StatTile icon={ShoppingCart} valeur={kpi.ventes} libelle="Ventes" teinte="#ff8a4c" />
        <StatTile icon={Wallet} valeur={`${kpi.ca_total} F`} libelle="Chiffre d'affaires" teinte="#34d399" />
        <StatTile icon={Wallet} valeur={`${resteAPayer} F`} libelle="Reste à payer" teinte="#f87171" />
      </div>

      <Card className="mb-4 flex items-center gap-4">
        <CircularProgress progress={tauxEncaissement} size={64} strokeWidth={6} gradientId="jus-commercial-encaissement-gradient" />
        <div>
          <p className="text-sm font-semibold text-white">{Math.round(tauxEncaissement)}% du chiffre d'affaires encaissé</p>
          <p className="text-xs text-muted">
            {totalPaye} F reçus sur {totalFacture} F facturés ({listeVentes.length} ventes)
          </p>
        </div>
      </Card>

      <div className="mb-3 flex items-center gap-2">
        <ReceiptText size={15} className="text-accent2" />
        <h2 className="text-sm font-bold text-white">Dernières ventes</h2>
      </div>
      <TableVirtus
        colonnes={['Client', 'Montant', 'Statut']}
        lignes={listeVentes.slice(0, 8).map((v) => [
          v.client_nom,
          `${v.montant_total} F`,
          <Badge tone={TONE[v.statut_paiement]}>{v.statut_display}</Badge>,
        ])}
      />
    </div>
  );
}
