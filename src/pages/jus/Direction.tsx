import { Citrus, ShoppingCart, Users, Wine } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { listerUtilisateursJus, listerVentes, obtenirSummary } from '../../lib/api/jus';

const TONE = { ACHAT_VENTE: 'success', PARTIELLE: 'warning', DEPOT_VENTE: 'neutral' } as const;

export default function Direction() {
  const summary = useApi(obtenirSummary, []);
  const utilisateurs = useApi(() => listerUtilisateursJus(), []);
  const ventes = useApi(() => listerVentes(), []);

  if (summary.chargement) return <EtatChargement texte="Chargement…" />;
  if (summary.erreur || !summary.donnees) return <EtatErreur message={summary.erreur ?? 'Indisponible'} recharger={summary.recharger} />;

  const { kpi } = summary.donnees;
  const listeUtilisateurs = utilisateurs.donnees ?? [];
  const actifs = listeUtilisateurs.filter((u) => u.is_active).length;
  const tauxActifs = listeUtilisateurs.length > 0 ? (actifs / listeUtilisateurs.length) * 100 : 0;
  const dernieresVentes = [...(ventes.donnees ?? [])].sort((a, b) => b.date_vente.localeCompare(a.date_vente)).slice(0, 6);

  return (
    <div>
      <PageHeader icon={Citrus} titre="Jus d'orange — Direction" sousTitre="Vue d'ensemble" />
      <div className="mb-4 grid grid-cols-4 gap-4">
        <StatTile icon={Users} valeur={listeUtilisateurs.length > 0 ? actifs : '—'} libelle="Utilisateurs actifs" teinte="#a78bfa" />
        <StatTile icon={ShoppingCart} valeur={`${kpi.ca_total} F`} libelle="Chiffre d'affaires" teinte="#34d399" />
        <StatTile icon={Wine} valeur={kpi.bouteilles} libelle="Bouteilles en stock" teinte="#ff8a4c" />
        <StatTile icon={ShoppingCart} valeur={kpi.ventes} libelle="Ventes" teinte="#60a5fa" />
      </div>

      <Card className="mb-4 flex items-center gap-4">
        <CircularProgress progress={tauxActifs} size={64} strokeWidth={6} gradientId="jus-direction-utilisateurs-gradient" />
        <div>
          <p className="text-sm font-semibold text-white">{Math.round(tauxActifs)}% des comptes sont actifs</p>
          <p className="text-xs text-muted">
            {actifs} actif(s) sur {listeUtilisateurs.length} utilisateur(s) de l'application Jus d'orange
          </p>
        </div>
      </Card>

      <h2 className="mb-3 text-sm font-bold text-white">Activité récente — ventes</h2>
      {ventes.erreur ? (
        <EtatErreur message={ventes.erreur} recharger={ventes.recharger} />
      ) : (
        <TableVirtus
          colonnes={['Client', 'Date', 'Montant', 'Statut']}
          lignes={dernieresVentes.map((v) => [
            v.client_nom,
            v.date_vente,
            `${v.montant_total} F`,
            <Badge tone={TONE[v.statut_paiement]}>{v.statut_display}</Badge>,
          ])}
        />
      )}
    </div>
  );
}
