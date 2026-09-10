import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { useApi } from '../../lib/hooks/useApi';
import {
  LIBELLES_STATUT,
  exporterPublicationsCsv,
  exporterTournagesCsv,
  tableauDeBord,
  type StatutEvenement,
} from '../../lib/api/planning';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const COULEUR_STATUT: Record<StatutEvenement, string> = {
  pending: '#facc15',
  completed: '#34d399',
  not_realized: '#f87171',
  cancelled: '#6b7280',
  rescheduled: '#60a5fa',
};

const maintenant = new Date();

export function CalendrierPlanning() {
  const [periode, setPeriode] = useState({ mois: maintenant.getMonth() + 1, annee: maintenant.getFullYear() });
  const { donnees, chargement, erreur, recharger } = useApi(() => tableauDeBord(periode.mois, periode.annee), [periode.mois, periode.annee]);

  const changerMois = (delta: number) => {
    setPeriode((p) => {
      const total = p.mois - 1 + delta;
      const annee = p.annee + Math.floor(total / 12);
      const mois = ((total % 12) + 12) % 12;
      return { mois: mois + 1, annee };
    });
  };

  if (chargement) return <EtatChargement texte="Chargement du planning…" />;
  if (erreur) return <EtatErreur message={erreur} recharger={recharger} />;
  if (!donnees) return null;

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-0">
        <h2 className="text-base font-bold text-white">
          Planning global — {MOIS[periode.mois - 1]} {periode.annee}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => exporterTournagesCsv(periode.mois, periode.annee)}
            title="Exporter les tournages"
            className="flex h-7 items-center gap-1 rounded-full bg-surface2 px-2.5 text-[11px] font-semibold text-muted hover:text-white"
          >
            <Download size={12} /> CSV
          </button>
          <button
            onClick={() => changerMois(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface2"
          >
            <ChevronLeft size={14} className="text-white" />
          </button>
          <button
            onClick={() => changerMois(1)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface2"
          >
            <ChevronRight size={14} className="text-white" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[720px] border-separate border-spacing-1">
          <thead>
            <tr>
              {JOURS.map((jour) => (
                <th key={jour} className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {jour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {donnees.calendrier.map((semaine, si) => (
              <tr key={si}>
                {semaine.map((jour, ci) => (
                  <td
                    key={ci}
                    className={`h-24 w-[14.2%] rounded-xl border border-border p-1.5 align-top ${
                      jour.est_mois_courant ? 'bg-surface2/60' : 'bg-transparent opacity-40'
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-muted">{Number(jour.date.split('-')[2])}</span>
                    <div className="mt-1 space-y-1">
                      {jour.tournages.map((t) => (
                        <div
                          key={`t-${t.id}`}
                          title={`Tournage — ${t.client_nom} (${LIBELLES_STATUT[t.status]})`}
                          className="truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: `${COULEUR_STATUT[t.status]}cc` }}
                        >
                          🎥 {t.client_nom}
                        </div>
                      ))}
                      {jour.publications.map((p) => (
                        <div
                          key={`p-${p.id}`}
                          title={`Publication — ${p.client_nom} (${LIBELLES_STATUT[p.status]})`}
                          className="truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: `${COULEUR_STATUT[p.status]}cc` }}
                        >
                          📢 {p.client_nom}
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border p-5 text-[11px] text-muted">
        {(Object.entries(LIBELLES_STATUT) as [StatutEvenement, string][]).map(([statut, libelle]) => (
          <span key={statut} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COULEUR_STATUT[statut] }} /> {libelle}
          </span>
        ))}
        <button
          onClick={() => exporterPublicationsCsv(periode.mois, periode.annee)}
          className="ml-auto flex items-center gap-1 font-semibold text-accent2 hover:text-accent"
        >
          <Download size={12} /> Exporter les publications
        </button>
      </div>
    </Card>
  );
}
