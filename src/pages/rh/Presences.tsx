import { useState } from 'react';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { Card } from '../../components/ui-light/Card';
import { EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { Badge, TableVirtus } from '../../components/ui-light/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { listerPresences, pointerArrivee, pointerDepart } from '../../lib/api/rh';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PRESENT: 'success',
  RETARD: 'warning',
  ABSENT: 'danger',
  CONGE: 'neutral',
  MISSION: 'neutral',
  TELETRAVAIL: 'neutral',
  REPOS: 'neutral',
};

export default function Presences() {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const presences = useApi(() => listerPresences(), []);
  const arrivee = useAction(pointerArrivee);
  const depart = useAction(pointerDepart);
  const [commentaire, setCommentaire] = useState('');

  const presenceDuJour = (presences.donnees ?? []).find((p) => p.date === aujourdhui) ?? null;

  async function enregistrerArrivee() {
    await arrivee.executer(undefined, commentaire || undefined);
    setCommentaire('');
    presences.recharger();
  }

  async function enregistrerDepart() {
    await depart.executer(undefined, commentaire || undefined);
    setCommentaire('');
    presences.recharger();
  }

  return presences.erreur ? (
    <EtatErreur message={presences.erreur} recharger={presences.recharger} />
  ) : (
    <div>
      <PageHeader icon={Clock} titre="Présences" sousTitre="Pointage du jour et historique" accent="#d03e0d" />

      <Card className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {presenceDuJour ? `Arrivée : ${presenceDuJour.heure_arrivee ?? '—'} · Départ : ${presenceDuJour.heure_depart ?? '—'}` : "Aucun pointage aujourd'hui"}
          </p>
          {presenceDuJour ? (
            <div className="mt-1">
              <Badge tone={TONE[presenceDuJour.statut] ?? 'neutral'}>{presenceDuJour.statut_libelle}</Badge>
            </div>
          ) : null}
        </div>
        <div className="flex flex-1 items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Commentaire (optionnel)</label>
            <input
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Retard trafic, mission..."
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rh-marque500 focus:outline-none"
            />
          </div>
          {!presenceDuJour?.heure_arrivee ? (
            <button
              onClick={enregistrerArrivee}
              disabled={arrivee.enCours}
              className="flex items-center gap-1.5 rounded-xl bg-rh-marque500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              <LogIn size={14} /> {arrivee.enCours ? 'Envoi...' : "Pointer l'arrivée"}
            </button>
          ) : !presenceDuJour.heure_depart ? (
            <button
              onClick={enregistrerDepart}
              disabled={depart.enCours}
              className="flex items-center gap-1.5 rounded-xl bg-rh-marque500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              <LogOut size={14} /> {depart.enCours ? 'Envoi...' : 'Pointer le départ'}
            </button>
          ) : (
            <span className="text-xs font-semibold text-slate-500">Journée déjà pointée</span>
          )}
        </div>
      </Card>
      {(arrivee.erreur || depart.erreur) ? <p className="mb-4 text-xs font-semibold text-rose-600">{arrivee.erreur ?? depart.erreur}</p> : null}

      <h2 className="mb-3 text-sm font-bold text-slate-900">Historique</h2>
      <TableVirtus
        colonnes={['Date', 'Arrivée', 'Départ', 'Heures', 'Statut']}
        lignes={(presences.donnees ?? []).map((p) => [
          p.date,
          p.heure_arrivee ?? '—',
          p.heure_depart ?? '—',
          p.heures_travaillees !== null ? `${p.heures_travaillees}h` : '—',
          <Badge tone={TONE[p.statut] ?? 'neutral'}>{p.statut_libelle}</Badge>,
        ])}
      />
    </div>
  );
}
