import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import {
  LIBELLES_STATUT,
  changerStatutPublication,
  creerPublication,
  listerClients,
  listerPublications,
  modifierPublication,
  type StatutEvenement,
} from '../../lib/api/planning';

const TONE: Record<StatutEvenement, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  not_realized: 'danger',
  cancelled: 'neutral',
  rescheduled: 'warning',
};

export default function Publications() {
  const clients = useApi(listerClients, []);
  const publications = useApi(listerPublications, []);
  const creation = useAction(creerPublication);
  const modification = useAction(modifierPublication);
  const statut = useAction(changerStatutPublication);

  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);

  function reinitialiser() {
    setIdEnEdition(null);
    setClientId('');
    setDate('');
    setDescription('');
    setAvertissements([]);
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) return;
    const reponse =
      idEnEdition !== null
        ? await modification.executer(idEnEdition, { client: Number(clientId), date, description })
        : await creation.executer({ client: Number(clientId), date, description });
    setAvertissements(reponse.avertissements ?? []);
    setIdEnEdition(null);
    setClientId('');
    setDate('');
    setDescription('');
    publications.recharger();
  }

  if (publications.erreur) return <EtatErreur message={publications.erreur} recharger={publications.recharger} />;

  return (
    <div>
      <PageHeader icon={Megaphone} titre="Publications" sousTitre="Ce qui est publié ou programmé" />

      <div className="grid grid-cols-[1fr_1.6fr] gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">{idEnEdition !== null ? 'Modifier la publication' : 'Nouvelle publication'}</h2>
            {idEnEdition !== null && (
              <button type="button" onClick={reinitialiser} className="text-xs font-semibold text-accent2 hover:text-accent">
                Annuler
              </button>
            )}
          </div>
          <form onSubmit={envoyer} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
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
              <label className="mb-1.5 block text-xs font-semibold text-muted">Date et heure</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>
            {(creation.erreur ?? modification.erreur) ? (
              <p className="text-xs font-semibold text-red-400">{creation.erreur ?? modification.erreur}</p>
            ) : null}
            {avertissements.length > 0 && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-2.5 text-xs text-accent2">
                {avertissements.map((a, i) => (
                  <p key={i}>⚠ {a}</p>
                ))}
              </div>
            )}
            <button
              type="submit"
              disabled={creation.enCours || modification.enCours}
              className="mt-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black disabled:opacity-60"
            >
              {creation.enCours || modification.enCours ? 'Envoi...' : idEnEdition !== null ? 'Mettre à jour' : 'Planifier'}
            </button>
          </form>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Publications</h2>
          {publications.chargement ? (
            <EtatChargement />
          ) : (
            <TableVirtus
              colonnes={['Client', 'Date', 'Statut', '', '']}
              lignes={(publications.donnees ?? []).map((p) => [
                p.client_nom,
                new Date(p.date).toLocaleString('fr-FR'),
                <Badge tone={TONE[p.status]}>{LIBELLES_STATUT[p.status]}</Badge>,
                <button
                  onClick={() => {
                    setIdEnEdition(p.id);
                    setClientId(String(p.client));
                    setDate(p.date.slice(0, 16));
                    setDescription(p.description);
                  }}
                  className="text-xs font-semibold text-accent2 hover:text-accent"
                >
                  Modifier
                </button>,
                <select
                  defaultValue=""
                  disabled={statut.enCours}
                  onChange={(e) => {
                    const valeur = e.target.value as StatutEvenement;
                    if (valeur) statut.executer(p.id, valeur).then(() => publications.recharger());
                  }}
                  className="rounded-lg border border-border bg-surface2 px-2 py-1 text-xs text-white"
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
