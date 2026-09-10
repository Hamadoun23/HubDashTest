import { AlertTriangle, Boxes, FlaskConical, Sprout, Wine } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { TrendChart } from '../../components/ui/TrendChart';
import { useApi } from '../../lib/hooks/useApi';
import { listerCueillettes, obtenirSummary } from '../../lib/api/jus';

export default function Production() {
  const summary = useApi(obtenirSummary, []);
  const cueillettes = useApi(() => listerCueillettes(), []);

  if (summary.chargement || cueillettes.chargement) return <EtatChargement texte="Chargement…" />;
  if (summary.erreur || !summary.donnees) return <EtatErreur message={summary.erreur ?? 'Indisponible'} recharger={summary.recharger} />;
  if (cueillettes.erreur) return <EtatErreur message={cueillettes.erreur} recharger={cueillettes.recharger} />;

  const { kpi, stock_articles } = summary.donnees;
  const listeCueillettes = cueillettes.donnees ?? [];

  const articlesOk = stock_articles.filter((a) => a.stock >= a.seuil).length;
  const disponibiliteStock = stock_articles.length > 0 ? (articlesOk / stock_articles.length) * 100 : 100;

  const parJour = new Map<string, number>();
  for (const c of listeCueillettes) {
    parJour.set(c.date_cueil, (parJour.get(c.date_cueil) ?? 0) + c.qte_total);
  }
  const tendanceRecolte = Array.from(parJour.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([date, total]) => ({ label: date.slice(5), valeur: total }));

  const dernieresCueillettes = [...listeCueillettes]
    .sort((a, b) => b.date_cueil.localeCompare(a.date_cueil))
    .slice(0, 6);

  return (
    <div>
      <PageHeader icon={FlaskConical} titre="Jus d'orange — Production" sousTitre="De la cueillette au conditionnement" />
      <div className="mb-4 grid grid-cols-4 gap-4">
        <StatTile icon={Sprout} valeur={`${kpi.recolte_total} kg`} libelle="Récolte totale" teinte="#4ade80" />
        <StatTile icon={Boxes} valeur={kpi.jus_stock} libelle="Stock de jus" teinte="#60a5fa" />
        <StatTile icon={Wine} valeur={kpi.bouteilles} libelle="Bouteilles en stock" teinte="#a78bfa" />
        <StatTile icon={AlertTriangle} valeur={kpi.articles_sous_seuil} libelle="Articles sous le seuil" teinte="#f87171" />
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto] gap-4">
        {tendanceRecolte.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-bold text-white">Récolte par jour (kg)</h2>
            <TrendChart donnees={tendanceRecolte} formatValeur={(v) => `${v} kg`} />
          </Card>
        )}
        <Card className="flex flex-col items-center justify-center gap-2">
          <CircularProgress progress={disponibiliteStock} gradientId="jus-production-stock-gradient" />
          <p className="text-center text-xs text-muted">
            Disponibilité du stock
            <br />
            ({articlesOk}/{stock_articles.length} articles au-dessus du seuil)
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-bold text-white">Dernières cueillettes</h2>
        {dernieresCueillettes.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">Aucune cueillette enregistrée pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dernieresCueillettes.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface2 p-3">
                <div>
                  <p className="text-sm font-semibold text-white">{c.producteur_display || c.producteur_nom_archive}</p>
                  <p className="text-xs text-muted">
                    {c.date_cueil} · {c.qte_total} kg · qualité {Math.round(c.taux_qualite)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
