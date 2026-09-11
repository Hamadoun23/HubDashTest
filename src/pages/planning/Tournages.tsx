import { useState } from 'react';
import { Video } from 'lucide-react';
import { Card } from '../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { Badge, TableVirtus } from '../../components/ui-light/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import {
  LIBELLES_STATUT,
  changerStatutTournage,
  creerTournage,
  listerClients,
  listerTournages,
  modifierTournage,
  type StatutEvenement,
} from '../../lib/api/planning';

const TONE: Record<StatutEvenement, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  not_realized: 'danger',
  cancelled: 'neutral',
  rescheduled: 'warning',
};

export default function Tournages() {
  const clients = useApi(listerClients, []);
  const tournages = useApi(listerTournages, []);
  const creation = useAction(creerTournage);
  const modification = useAction(modifierTournage);
  const statut = useAction(changerStatutTournage);

  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);

  function reinitialiser() {
    setIdEnEdition(null);
    setClientId('');
    setDate('');
    setDescription('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) return;
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, { client: Number(clientId), date, description });
    } else {
      await creation.executer({ client: Number(clientId), date, description });
    }
    reinitialiser();
    tournages.recharger();
  }

  if (tournages.erreur) return <EtatErreur message={tournages.erreur} recharger={tournages.recharger} />;

  return (
    <div>
      <PageHeader icon={Video} titre="Tournages" sousTitre="Planifiés et à confirmer" accent="#e8481b" />

      <div className="grid grid-cols-[1fr_1.6fr] gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">{idEnEdition !== null ? 'Modifier le tournage' : 'Nouveau tournage'}</h2>
            {idEnEdition !== null && (
              <button type="button" onClick={reinitialiser} className="text-xs font-semibold text-planning-o3 hover:text-[#c93a15]">
                Annuler
              </button>
            )}
          </div>
          <form onSubmit={envoyer} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-planning-o3 focus:outline-none"
              >
                <option value="">Sélectionner...</option>
                {(clients.donnees ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom_entreprise}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Date et heure</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-planning-o3 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-planning-o3 focus:outline-none"
              />
            </div>
            {(creation.erreur ?? modification.erreur) ? (
              <p className="text-xs font-semibold text-rose-600">{creation.erreur ?? modification.erreur}</p>
            ) : null}
            <button
              type="submit"
              disabled={creation.enCours || modification.enCours}
              className="mt-1 rounded-xl bg-planning-o3 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {creation.enCours || modification.enCours ? 'Envoi...' : idEnEdition !== null ? 'Mettre à jour' : 'Planifier'}
            </button>
          </form>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-bold text-slate-900">Tournages</h2>
          {tournages.chargement ? (
            <EtatChargement />
          ) : (
            <TableVirtus
              colonnes={['Client', 'Date', 'Statut', '', '']}
              lignes={(tournages.donnees ?? []).map((t) => [
                t.client_nom,
                new Date(t.date).toLocaleString('fr-FR'),
                <Badge tone={TONE[t.status]}>{LIBELLES_STATUT[t.status]}</Badge>,
                <button
                  onClick={() => {
                    setIdEnEdition(t.id);
                    setClientId(String(t.client));
                    setDate(t.date.slice(0, 16));
                    setDescription(t.description);
                  }}
                  className="text-xs font-semibold text-planning-o3 hover:text-[#c93a15]"
                >
                  Modifier
                </button>,
                <select
                  defaultValue=""
                  disabled={statut.enCours}
                  onChange={(e) => {
                    const valeur = e.target.value as StatutEvenement;
                    if (valeur) statut.executer(t.id, valeur).then(() => tournages.recharger());
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                >
                  <option value="">Changer le statut...</option>
                  {(Object.entries(LIBELLES_STATUT) as [StatutEvenement, string][]).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </select>,
              ])}
            />
          )}
        </div>
      </div>
    </div>
  );
}
