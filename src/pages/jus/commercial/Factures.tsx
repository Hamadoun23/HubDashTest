import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { listerFactures, modifierFacture, payerFacture, supprimerFacture, type ModePaie } from '../../../lib/api/jus';

export default function Factures() {
  const factures = useApi(() => listerFactures(), []);
  const paiement = useAction(payerFacture);
  const modification = useAction(modifierFacture);
  const suppression = useAction(supprimerFacture);

  const [enPaiement, setEnPaiement] = useState<number | null>(null);
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState<ModePaie>('ESPECE');

  // Pas de formulaire de création ici (une facture naît d'une commande complétée) : on
  // permet la correction du montant et de l'échéance via un petit panneau d'édition dédié.
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [montantFacture, setMontantFacture] = useState('');
  const [echeance, setEcheance] = useState('');

  async function payer(id: number) {
    await paiement.executer(id, { date_paie: new Date().toISOString().slice(0, 10), montant: Number(montant), mode_paie: mode });
    setEnPaiement(null);
    setMontant('');
    factures.recharger();
  }

  async function enregistrerModification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition === null) return;
    await modification.executer(idEnEdition, { montant: Number(montantFacture), date_echeance: echeance });
    setIdEnEdition(null);
    setMontantFacture('');
    setEcheance('');
    factures.recharger();
  }

  function annulerEdition() {
    setIdEnEdition(null);
    setMontantFacture('');
    setEcheance('');
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cette facture ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) annulerEdition();
    factures.recharger();
  }

  if (factures.chargement) return <EtatChargement texte="Chargement des factures…" />;
  if (factures.erreur) return <EtatErreur message={factures.erreur} recharger={factures.recharger} />;

  return (
    <div>
      <PageHeader icon={ReceiptText} titre="Factures" sousTitre="Facturation client" />
      <TableVirtus
        colonnes={['Référence', 'Client', 'Montant', 'Reste', 'Échéance', 'Statut', '']}
        lignes={(factures.donnees ?? []).map((f) => [
          f.num_fact,
          f.client_nom,
          `${f.montant} F`,
          `${f.reste_a_payer} F`,
          f.date_echeance,
          <Badge tone={f.reste_a_payer <= 0 ? 'success' : 'warning'}>{f.statut_display}</Badge>,
          <div className="flex items-center gap-2">
            {f.reste_a_payer > 0 &&
              (enPaiement === f.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    placeholder="Montant"
                    className="w-20 rounded-lg border border-border bg-surface2 px-2 py-1 text-xs text-white"
                  />
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ModePaie)}
                    className="rounded-lg border border-border bg-surface2 px-2 py-1 text-xs text-white"
                  >
                    <option value="ESPECE">Espèces</option>
                    <option value="CHEQUE">Chèque</option>
                    <option value="VIREMENT">Virement</option>
                    <option value="MOBILE">Mobile</option>
                  </select>
                  <button
                    onClick={() => payer(f.id)}
                    disabled={paiement.enCours}
                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black disabled:opacity-50"
                  >
                    Valider
                  </button>
                </div>
              ) : (
                <button onClick={() => setEnPaiement(f.id)} className="text-xs font-semibold text-accent2 hover:text-accent">
                  Enregistrer un paiement →
                </button>
              ))}
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(f.id);
                setMontantFacture(String(f.montant));
                setEcheance(f.date_echeance);
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => supprimer(f.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {(paiement.erreur || suppression.erreur) ? (
        <p className="mt-2 text-xs font-semibold text-red-400">{paiement.erreur ?? suppression.erreur}</p>
      ) : null}

      {idEnEdition !== null && (
        <form onSubmit={enregistrerModification} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Montant</label>
            <input
              value={montantFacture}
              onChange={(e) => setMontantFacture(e.target.value)}
              required
              className="w-32 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Échéance</label>
            <input
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
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
