import { useState } from 'react';
import { Wine } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { listerBouteilles, modifierBouteille, supprimerBouteille } from '../../../lib/api/jus';

export default function Bouteilles() {
  const bouteilles = useApi(() => listerBouteilles(), []);
  const modification = useAction(modifierBouteille);
  const suppression = useAction(supprimerBouteille);

  // Pas de formulaire de création : les bouteilles naissent d'un conditionnement.
  // Seul le statut est raisonnable à corriger ici (aucun autre champ métier libre) —
  // pas d'enum de statuts exposée côté API pour ce module, saisie libre volontairement.
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [statut, setStatut] = useState('');

  if (bouteilles.chargement) return <EtatChargement texte="Chargement du stock de bouteilles…" />;
  if (bouteilles.erreur) return <EtatErreur message={bouteilles.erreur} recharger={bouteilles.recharger} />;

  const liste = bouteilles.donnees ?? [];
  const parFormat = new Map<string, number>();
  liste.forEach((b) => parFormat.set(b.format_display, (parFormat.get(b.format_display) ?? 0) + 1));

  async function enregistrerStatut(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition === null) return;
    await modification.executer(idEnEdition, { statut });
    setIdEnEdition(null);
    setStatut('');
    bouteilles.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cette bouteille ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) {
      setIdEnEdition(null);
      setStatut('');
    }
    bouteilles.recharger();
  }

  return (
    <div>
      <PageHeader icon={Wine} titre="Bouteilles" sousTitre="Stock de produit fini par format" />

      <div className="mb-4 grid grid-cols-2 gap-4">
        {Array.from(parFormat.entries()).map(([format, total]) => (
          <Card key={format} className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Format {format}</span>
            <span className="text-lg font-extrabold text-white">{total}</span>
          </Card>
        ))}
      </div>

      <TableVirtus
        colonnes={['Code-barres', 'Format', 'Statut', 'DLC', '']}
        lignes={liste.map((b) => [
          b.codebar,
          b.format_display,
          <Badge tone={b.statut === 'EN_STOCK' ? 'success' : 'neutral'}>{b.statut_display}</Badge>,
          b.dlc,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(b.id);
                setStatut(b.statut);
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => supprimer(b.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {suppression.erreur ? <p className="mt-2 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}

      {idEnEdition !== null && (
        <form onSubmit={enregistrerStatut} className="mt-4 flex items-end gap-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Nouveau statut de la bouteille #{idEnEdition}</label>
            <input
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
              required
              placeholder="EN_STOCK, VENDUE, CASSEE..."
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={modification.enCours}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
          >
            {modification.enCours ? 'Envoi...' : 'Mettre à jour'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIdEnEdition(null);
              setStatut('');
            }}
            className="text-xs font-semibold text-muted hover:text-white"
          >
            Annuler la modification
          </button>
          {modification.erreur ? <p className="text-xs font-semibold text-red-400">{modification.erreur}</p> : null}
        </form>
      )}
    </div>
  );
}
