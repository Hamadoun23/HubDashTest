import { Boxes, Factory, ShoppingCart, Sprout, Wine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirSummary } from '../../lib/api/jus';

const MODULES = [
  { chemin: '/jus/reporting/recolte', libelle: 'Récolte' },
  { chemin: '/jus/reporting/appro', libelle: 'Approvisionnement' },
  { chemin: '/jus/reporting/fabrication', libelle: 'Fabrication' },
  { chemin: '/jus/reporting/emballage', libelle: 'Emballage' },
  { chemin: '/jus/reporting/entrepot', libelle: 'Entrepôt' },
  { chemin: '/jus/reporting/distribution', libelle: 'Distribution' },
];

export default function Reporting() {
  const summary = useApi(obtenirSummary, []);

  if (summary.chargement) return <EtatChargement texte="Chargement…" />;
  if (summary.erreur || !summary.donnees) return <EtatErreur message={summary.erreur ?? 'Indisponible'} recharger={summary.recharger} />;

  const { kpi, stock_articles } = summary.donnees;
  const articlesOk = stock_articles.filter((a) => a.stock >= a.seuil).length;
  const disponibiliteStock = stock_articles.length > 0 ? (articlesOk / stock_articles.length) * 100 : 100;

  return (
    <div>
      <PageHeader icon={Boxes} titre="Jus d'orange — Reporting" sousTitre="Récolte, fabrication, distribution" />

      <div className="mb-4 grid grid-cols-4 gap-4">
        <StatTile icon={Sprout} valeur={`${kpi.recolte_total} kg`} libelle="Récolte totale" teinte="#4ade80" />
        <StatTile icon={Wine} valeur={kpi.bouteilles} libelle="Bouteilles" teinte="#a78bfa" />
        <StatTile icon={ShoppingCart} valeur={`${kpi.ca_total} F`} libelle="Chiffre d'affaires" teinte="#34d399" />
        <StatTile icon={Factory} valeur={kpi.productions} libelle="Ordres de fabrication" teinte="#60a5fa" />
      </div>

      <Card className="mb-4 flex items-center gap-4">
        <CircularProgress progress={disponibiliteStock} size={64} strokeWidth={6} gradientId="jus-reporting-stock-gradient" />
        <div>
          <p className="text-sm font-semibold text-white">{Math.round(disponibiliteStock)}% des articles au-dessus du seuil</p>
          <p className="text-xs text-muted">
            {articlesOk} sur {stock_articles.length} article(s) de stock ({kpi.articles_sous_seuil} sous le seuil d'alerte)
          </p>
        </div>
      </Card>

      <h2 className="mb-3 text-sm font-bold text-white">État des stocks</h2>
      <TableVirtus
        colonnes={['Article', 'Stock', 'Seuil', 'Statut']}
        lignes={stock_articles.map((a) => [
          a.article,
          String(a.stock),
          String(a.seuil),
          a.stock >= a.seuil ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Sous le seuil</Badge>,
        ])}
      />

      <Card className="mt-4 flex flex-col gap-2">
        <h2 className="mb-2 text-sm font-bold text-white">Rapports par module</h2>
        {MODULES.map((m) => (
          <Link key={m.chemin} to={m.chemin} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-white hover:bg-surface2">
            {m.libelle}
            <span className="text-xs text-accent2">Voir le détail →</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
