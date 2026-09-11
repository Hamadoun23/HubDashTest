import { Award, Clapperboard, TrendingUp, Users } from 'lucide-react';
import { Card } from '../../components/ui-light/Card';
import { CircularProgress } from '../../components/ui-light/CircularProgress';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { StatTile } from '../../components/ui-light/StatTile';
import { TrendChart } from '../../components/ui-light/TrendChart';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirTableauDeBord } from '../../lib/api/campagnes';

const ACCENT = '#7c3aed';

export default function TableauDeBord() {
  const tableau = useApi(obtenirTableauDeBord, []);

  if (tableau.chargement) return <EtatChargement texte="Chargement du tableau de bord…" />;
  if (tableau.erreur || !tableau.donnees) return <EtatErreur message={tableau.erreur ?? 'Indisponible'} recharger={tableau.recharger} />;

  const d = tableau.donnees;

  return (
    <div>
      <PageHeader icon={Clapperboard} titre="Campagnes" sousTitre={`Bonjour ${d.user.display_name}`} accent={ACCENT} />

      {d.variant === 'commercial' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <StatTile icon={TrendingUp} valeur={d.vente.mesVentes} libelle="Mes ventes" teinte="#34d399" />
            <StatTile icon={Award} valeur={d.vente.monRang ?? '—'} libelle="Mon rang" teinte="#ff8a4c" />
          </div>
          {d.vente.campagneActive ? (
            <Card>
              <p className="text-xs text-slate-500">Campagne active</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{d.vente.campagneActive.nom}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {d.vente.campagneActive.date_debut} → {d.vente.campagneActive.date_fin}
              </p>
            </Card>
          ) : (
            <Card className="text-sm text-slate-500">Aucune campagne active pour le moment.</Card>
          )}
        </div>
      ) : d.variant === 'admin' || d.variant === 'direction' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-4">
            <StatTile icon={TrendingUp} valeur={d.ventesTotal} libelle="Ventes au total" teinte="#34d399" />
            <StatTile icon={TrendingUp} valeur={d.ventesMois} libelle="Ventes ce mois" teinte="#60a5fa" />
            <StatTile icon={Clapperboard} valeur={d.campagnesEnCours} libelle="Campagnes en cours" teinte="#ff8a4c" />
            <StatTile icon={Users} valeur={d.commerciauxCount} libelle="Commerciaux" teinte="#a78bfa" />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            {d.venteTrend.length > 0 && (
              <Card>
                <h2 className="mb-3 text-sm font-bold text-slate-900">Évolution des ventes</h2>
                <TrendChart donnees={d.venteTrend.map((valeur, i) => ({ label: String(i + 1), valeur }))} accent={ACCENT} />
              </Card>
            )}
            <Card className="flex flex-col items-center justify-center gap-2">
              <CircularProgress progress={d.pctCommerciauxActifs} gradientId="campagnes-commerciaux-actifs-gradient" accent={ACCENT} accentClair="#c4b5fd" />
              <p className="text-center text-xs text-slate-500">Commerciaux actifs</p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-bold text-slate-900">Classement</h2>
            {d.classement.length === 0 ? (
              <p className="text-xs text-slate-500">Aucune vente enregistrée pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {d.classement.slice(0, 8).map((c) => (
                  <div key={c.user_id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-800">
                      #{c.rang} {c.user_name}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{c.total_ventes}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-slate-800">
            {d.campagneActive ? `Campagne active : ${d.campagneActive.nom}` : 'Aucune campagne active pour le moment.'}
          </p>
        </Card>
      )}
    </div>
  );
}
