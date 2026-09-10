import { Trophy } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirPerformances } from '../../lib/api/campagnes';

export default function Performances() {
  const performances = useApi(() => obtenirPerformances(), []);

  if (performances.chargement) return <EtatChargement texte="Chargement des performances…" />;
  if (performances.erreur || !performances.donnees) {
    return <EtatErreur message={performances.erreur ?? 'Indisponible'} recharger={performances.recharger} />;
  }

  const p = performances.donnees;

  return (
    <div>
      <PageHeader icon={Trophy} titre="Performances" sousTitre={p.libellePeriode} />

      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatTile icon={Trophy} valeur={p.stats.total_ventes} libelle="Ventes totales" teinte="#34d399" />
        {p.vueCommerciale && (
          <>
            <StatTile icon={Trophy} valeur={p.stats.mes_ventes ?? 0} libelle="Mes ventes" teinte="#60a5fa" />
            <StatTile icon={Trophy} valeur={p.stats.mon_rang ?? '—'} libelle="Mon rang" teinte="#ff8a4c" />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Classement commerciaux</h2>
          <TableVirtus
            colonnes={['Rang', 'Nom', 'Ventes', '%']}
            lignes={p.classement.map((c) => [c.rang, c.user_name, c.total_ventes, `${c.pct_volume}%`])}
          />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Classement agences</h2>
          <TableVirtus
            colonnes={['Rang', 'Agence', 'Ventes', '%']}
            lignes={p.classementAgences.map((a) => [a.rang, a.agence_nom, a.total_ventes, `${a.pct_volume}%`])}
          />
        </div>
      </div>
    </div>
  );
}
