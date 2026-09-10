import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  completerCommande,
  creerCommande,
  listerCommandes,
  modifierCommande,
  obtenirOptions,
  supprimerCommande,
  type StatutPaiement,
} from '../../../lib/api/jus';

export default function Commandes() {
  const commandes = useApi(() => listerCommandes(), []);
  const options = useApi(() => obtenirOptions(), []);
  const creation = useAction(creerCommande);
  const modification = useAction(modifierCommande);
  const suppression = useAction(supprimerCommande);
  const completion = useAction(completerCommande);

  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [clientId, setClientId] = useState('');
  const [q33, setQ33] = useState('');
  const [q1l, setQ1l] = useState('');
  const [enCompletion, setEnCompletion] = useState<number | null>(null);
  const [statutPaiement, setStatutPaiement] = useState<StatutPaiement>('ACHAT_VENTE');

  function reinitialiser() {
    setIdEnEdition(null);
    setClientId('');
    setQ33('');
    setQ1l('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = { client: Number(clientId), quantite_33cl: q33 ? Number(q33) : undefined, quantite_1l: q1l ? Number(q1l) : undefined };
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, payload);
    } else {
      await creation.executer(payload);
    }
    reinitialiser();
    commandes.recharger();
  }

  async function completer(id: number) {
    await completion.executer(id, { statut_paiement: statutPaiement });
    setEnCompletion(null);
    commandes.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cette commande ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) reinitialiser();
    commandes.recharger();
  }

  if (commandes.erreur) return <EtatErreur message={commandes.erreur} recharger={commandes.recharger} />;

  return (
    <div>
      <PageHeader icon={ShoppingCart} titre="Commandes" sousTitre="Suivi des commandes clients" />

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">{idEnEdition !== null ? 'Modifier la commande' : 'Nouvelle commande'}</h2>
          {idEnEdition !== null && (
            <button type="button" onClick={reinitialiser} className="text-xs font-semibold text-muted hover:text-white">
              Annuler la modification
            </button>
          )}
        </div>
        <form onSubmit={envoyer} className="mt-3 flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            >
              <option value="">Sélectionner...</option>
              {(options.donnees?.clients ?? []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Quantité 33cl</label>
            <input
              value={q33}
              onChange={(e) => setQ33(e.target.value)}
              className="w-24 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Quantité 1L</label>
            <input
              value={q1l}
              onChange={(e) => setQ1l(e.target.value)}
              className="w-24 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={creation.enCours || modification.enCours}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
          >
            {creation.enCours || modification.enCours ? 'Envoi...' : idEnEdition !== null ? 'Mettre à jour' : 'Créer'}
          </button>
        </form>
        {(creation.erreur ?? modification.erreur) ? (
          <p className="mt-2 text-xs font-semibold text-red-400">{creation.erreur ?? modification.erreur}</p>
        ) : null}
      </Card>

      <TableVirtus
        colonnes={['Client', '33cl', '1L', 'Total', 'Statut', '']}
        lignes={(commandes.donnees ?? []).map((c) => [
          c.client_nom,
          c.quantite_33cl,
          c.quantite_1l,
          `${c.total} F`,
          c.est_completee ? <Badge tone="success">Complétée</Badge> : <Badge tone="warning">En attente</Badge>,
          <div className="flex items-center gap-2">
            {!c.est_completee &&
              (enCompletion === c.id ? (
                <div className="flex items-center gap-2">
                  <select
                    value={statutPaiement}
                    onChange={(e) => setStatutPaiement(e.target.value as StatutPaiement)}
                    className="rounded-lg border border-border bg-surface2 px-2 py-1 text-xs text-white"
                  >
                    <option value="ACHAT_VENTE">Achat/vente (payé)</option>
                    <option value="PARTIELLE">Paiement partiel</option>
                    <option value="DEPOT_VENTE">Dépôt-vente</option>
                  </select>
                  <button
                    onClick={() => completer(c.id)}
                    disabled={completion.enCours}
                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black disabled:opacity-50"
                  >
                    Valider
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => setEnCompletion(c.id)} className="text-xs font-semibold text-accent2 hover:text-accent">
                    Compléter →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdEnEdition(c.id);
                      setClientId(String(c.client));
                      setQ33(String(c.quantite_33cl));
                      setQ1l(String(c.quantite_1l));
                    }}
                    className="text-xs font-semibold text-accent2 hover:text-accent"
                  >
                    Modifier
                  </button>
                </>
              ))}
            <button
              type="button"
              onClick={() => supprimer(c.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {(completion.erreur || suppression.erreur) ? (
        <p className="mt-2 text-xs font-semibold text-red-400">{completion.erreur ?? suppression.erreur}</p>
      ) : null}
    </div>
  );
}
