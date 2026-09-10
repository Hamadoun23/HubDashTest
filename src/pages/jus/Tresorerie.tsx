import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerTresorerie, gererEcartTresorerie, obtenirOptions, obtenirRapprochement, supprimerTresorerie } from '../../lib/api/jus';

const TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  CONFORME: 'success',
  ECART_POSITIF: 'warning',
  ECART_NEGATIF: 'danger',
  EN_ATTENTE: 'warning',
};

export default function Tresorerie() {
  const rapprochement = useApi(obtenirRapprochement, []);
  const options = useApi(() => obtenirOptions(), []);
  const creation = useAction(creerTresorerie);
  const gestionEcart = useAction(gererEcartTresorerie);
  const suppression = useAction(supprimerTresorerie);

  const [paiementId, setPaiementId] = useState('');
  const [montantRecu, setMontantRecu] = useState('');
  const [date, setDate] = useState('');
  const [ecartEnCours, setEcartEnCours] = useState<number | null>(null);
  const [observation, setObservation] = useState('');

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer({ paiement: Number(paiementId), montant_recu: Number(montantRecu), date_reception: date });
    setPaiementId('');
    setMontantRecu('');
    setDate('');
    rapprochement.recharger();
  }

  async function traiterEcart(id: number) {
    if (!observation.trim()) return;
    await gestionEcart.executer(id, observation);
    setEcartEnCours(null);
    setObservation('');
    rapprochement.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cette déclaration de réception ?')) return;
    await suppression.executer(id);
    rapprochement.recharger();
  }

  if (rapprochement.chargement) return <EtatChargement texte="Chargement de la trésorerie…" />;
  if (rapprochement.erreur || !rapprochement.donnees) {
    return <EtatErreur message={rapprochement.erreur ?? 'Indisponible'} recharger={rapprochement.recharger} />;
  }

  const { lignes, totaux } = rapprochement.donnees;

  return (
    <div>
      <PageHeader icon={Landmark} titre="Trésorerie" sousTitre="Rapprochement des encaissements" />

      <div className="mb-4 grid grid-cols-4 gap-4">
        <Card><p className="text-xs text-muted">Total commercial</p><p className="mt-1 text-lg font-bold text-white">{totaux.total_commercial} F</p></Card>
        <Card><p className="text-xs text-muted">Total reçu</p><p className="mt-1 text-lg font-bold text-white">{totaux.total_recu} F</p></Card>
        <Card><p className="text-xs text-muted">Écart global</p><p className="mt-1 text-lg font-bold text-white">{totaux.ecart_global} F</p></Card>
        <Card><p className="text-xs text-muted">Écarts non traités</p><p className="mt-1 text-lg font-bold text-white">{totaux.nb_ecarts_non_traites}</p></Card>
      </div>

      <Card className="mb-4">
        <h2 className="text-sm font-bold text-white">Déclarer une réception de paiement</h2>
        <form onSubmit={envoyer} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Paiement</label>
            <select
              value={paiementId}
              onChange={(e) => setPaiementId(e.target.value)}
              required
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            >
              <option value="">Sélectionner...</option>
              {(options.donnees?.paiements_sans_reception ?? []).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Montant reçu</label>
            <input
              value={montantRecu}
              onChange={(e) => setMontantRecu(e.target.value)}
              required
              className="w-32 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
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
          <button type="submit" disabled={creation.enCours} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60">
            {creation.enCours ? 'Envoi...' : 'Enregistrer'}
          </button>
        </form>
        {creation.erreur ? <p className="mt-2 text-xs font-semibold text-red-400">{creation.erreur}</p> : null}
      </Card>

      <TableVirtus
        colonnes={['Facture', 'Client', 'Mode', 'Attendu', 'Reçu', 'Statut', '']}
        lignes={lignes.map((l) => [
          l.num_fact,
          l.client_nom,
          l.mode_display,
          `${l.montant_commercial} F`,
          l.montant_recu !== null ? `${l.montant_recu} F` : '—',
          <Badge tone={TONE[l.statut_reception] ?? 'neutral'}>{l.statut_reception}</Badge>,
          <div className="flex items-center gap-2">
            {l.reception_id && !l.ecart_traite && l.statut_reception !== 'CONFORME' ? (
              ecartEnCours === l.reception_id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Explication..."
                    className="w-32 rounded-lg border border-border bg-surface2 px-2 py-1 text-xs text-white"
                  />
                  <button
                    onClick={() => traiterEcart(l.reception_id!)}
                    disabled={gestionEcart.enCours}
                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black disabled:opacity-50"
                  >
                    Valider
                  </button>
                </div>
              ) : (
                <button onClick={() => setEcartEnCours(l.reception_id!)} className="text-xs font-semibold text-accent2 hover:text-accent">
                  Traiter l'écart →
                </button>
              )
            ) : null}
            {l.reception_id ? (
              <button
                type="button"
                onClick={() => supprimer(l.reception_id!)}
                disabled={suppression.enCours}
                className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Supprimer
              </button>
            ) : null}
          </div>,
        ])}
      />
      {suppression.erreur ? <p className="mt-3 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}
    </div>
  );
}
