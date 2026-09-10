import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { listerPaiements, modifierPaiement, supprimerPaiement, type ModePaie } from '../../../lib/api/jus';

export default function Paiements() {
  const paiements = useApi(() => listerPaiements(), []);
  const modification = useAction(modifierPaiement);
  const suppression = useAction(supprimerPaiement);

  // Pas de création ici (un paiement naît d'une facture) : correction ponctuelle d'une
  // ligne erronée (montant/mode/référence/date) via un panneau d'édition dédié.
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState<ModePaie>('ESPECE');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState('');

  async function enregistrerModification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition === null) return;
    await modification.executer(idEnEdition, { montant: Number(montant), mode_paie: mode, reference: reference || undefined, date_paie: date });
    annulerEdition();
    paiements.recharger();
  }

  function annulerEdition() {
    setIdEnEdition(null);
    setMontant('');
    setMode('ESPECE');
    setReference('');
    setDate('');
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement ce paiement ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) annulerEdition();
    paiements.recharger();
  }

  if (paiements.chargement) return <EtatChargement texte="Chargement des paiements…" />;
  if (paiements.erreur) return <EtatErreur message={paiements.erreur} recharger={paiements.recharger} />;

  return (
    <div>
      <PageHeader icon={Wallet} titre="Paiements" sousTitre="Encaissements reçus — enregistrés depuis une facture" />
      <TableVirtus
        colonnes={['Facture', 'Montant', 'Mode', 'Référence', 'Date', '']}
        lignes={(paiements.donnees ?? []).map((p) => [
          p.num_fact,
          `${p.montant} F`,
          p.mode_display,
          p.reference || '—',
          p.date_paie,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(p.id);
                setMontant(String(p.montant));
                setMode(p.mode_paie);
                setReference(p.reference);
                setDate(p.date_paie);
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => supprimer(p.id)}
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
        <form onSubmit={enregistrerModification} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Montant</label>
            <input
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
              className="w-28 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ModePaie)}
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            >
              <option value="ESPECE">Espèces</option>
              <option value="CHEQUE">Chèque</option>
              <option value="VIREMENT">Virement</option>
              <option value="MOBILE">Mobile</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Référence</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
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
          <button type="button" onClick={annulerEdition} className="text-xs font-semibold text-muted hover:text-white">
            Annuler la modification
          </button>
          {modification.erreur ? <p className="text-xs font-semibold text-red-400">{modification.erreur}</p> : null}
        </form>
      )}
    </div>
  );
}
