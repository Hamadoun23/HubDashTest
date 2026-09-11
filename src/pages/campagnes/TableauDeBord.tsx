import { Award, Clapperboard, TrendingUp, Users } from 'lucide-react';
import { Card } from '../../components/ui-light/Card';
import { Gauge } from '../../components/ui-light/Gauge';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { StatTile } from '../../components/ui-light/StatTile';
import { Sparkline } from '../../components/ui-light/Sparkline';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirTableauDeBord } from '../../lib/api/campagnes';

const ACCENT = '#FF6A3A';

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
            <StatTile icon={TrendingUp} valeur={d.vente.mesVentes} libelle="Mes ventes" teinte={ACCENT} />
            <StatTile icon={Award} valeur={d.vente.monRang ?? '—'} libelle="Mon rang" teinte="#4a5565" />
          </div>
          {d.vente.campagneActive ? (
            <Card>
              <p className="text-xs text-gray-500">Campagne active</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{d.vente.campagneActive.nom}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {d.vente.campagneActive.date_debut} → {d.vente.campagneActive.date_fin}
              </p>
            </Card>
          ) : (
            <Card className="text-sm text-gray-500">Aucune campagne active pour le moment.</Card>
          )}
        </div>
      ) : d.variant === 'admin' || d.variant === 'direction' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-4">
            <StatTile icon={TrendingUp} valeur={d.ventesTotal} libelle="Ventes au total" teinte={ACCENT} />
            <StatTile icon={TrendingUp} valeur={d.ventesMois} libelle="Ventes ce mois" teinte="#4a5565" />
            <StatTile icon={Clapperboard} valeur={d.campagnesEnCours} libelle="Campagnes en cours" teinte={ACCENT} />
            <div className="rounded-2xl bg-campagnes-primary p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium uppercase tracking-wide text-white/70">Commerciaux</p>
                  <p className="mt-1.5 truncate text-2xl font-semibold text-white">{d.commerciauxCount}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                  <Users size={18} strokeWidth={2} />
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            {d.venteTrend.length > 0 && (
              <Card className="p-5">
                <p className="text-sm font-semibold text-gray-900">Tendance des ventes</p>
                <p className="mb-4 text-xs text-gray-500">Par période</p>
                <Sparkline values={d.venteTrend} height={64} color={ACCENT} />
              </Card>
            )}
            <Card className="flex flex-col items-center justify-center gap-2 p-5">
              <Gauge value={d.pctCommerciauxActifs} color={ACCENT} label="commerciaux actifs" />
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold text-gray-900">Classement</h2>
            {d.classement.length === 0 ? (
              <p className="text-xs text-gray-500">Aucune vente enregistrée pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {d.classement.slice(0, 8).map((c) => (
                  <div key={c.user_id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-800">
                      #{c.rang} {c.user_name}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{c.total_ventes}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-gray-800">
            {d.campagneActive ? `Campagne active : ${d.campagneActive.nom}` : 'Aucune campagne active pour le moment.'}
          </p>
        </Card>
      )}
    </div>
  );
}
