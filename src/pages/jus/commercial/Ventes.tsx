import { useState } from 'react';
import { Citrus } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { listerVentes, modifierVente, supprimerVente, type StatutPaiement } from '../../../lib/api/jus';

const TONE = { ACHAT_VENTE: 'success', PARTIELLE: 'warning', DEPOT_VENTE: 'neutral' } as const;

export default function Ventes() {
  const ventes = useApi(() => listerVentes(), []);
  const modification = useAction(modifierVente);
  const suppression = useAction(supprimerVente);

  // Pas de création ici (une vente naît d'une commande complétée) et pas de champ libre
  // pertinent à éditer hormis le statut de paiement — c'est la seule modification proposée.
  const [enEdition, setEnEdition] = useState<number | null>(null);
  const [statutPaiement, setStatutPaiement] = useState<StatutPaiement>('ACHAT_VENTE');

  async function enregistrerStatut(id: number) {
    await modification.executer(id, { statut_paiement: statutPaiement });
    setEnEdition(null);
    ventes.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cette vente ?')) return;
    await suppression.executer(id);
    if (enEdition === id) setEnEdition(null);
    ventes.recharger();
  }

  if (ventes.chargement) return <EtatChargement texte="Chargement des ventes…" />;
  if (ventes.erreur) return <EtatErreur message={ventes.erreur} recharger={ventes.recharger} />;

  return (
    <div>
      <PageHeader icon={Citrus} titre="Ventes" sousTitre="Toutes les ventes commerciales — créées depuis une commande complétée" />
      <TableVirtus
        colonnes={['Client', 'Montant', 'Payé', 'Reste', 'Statut', '']}
        lignes={(ventes.donnees ?? []).map((v) => [
          v.client_nom,
          `${v.montant_total} F`,
          `${v.total_paye} F`,
          `${v.reste_a_payer} F`,
          <Badge tone={TONE[v.statut_paiement]}>{v.statut_display}</Badge>,
          <div className="flex items-center gap-2">
            {enEdition === v.id ? (
              <>
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
                  onClick={() => enregistrerStatut(v.id)}
                  disabled={modification.enCours}
                  className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black disabled:opacity-50"
                >
                  Valider
                </button>
                <button type="button" onClick={() => setEnEdition(null)} className="text-xs font-semibold text-muted hover:text-white">
                  Annuler
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEnEdition(v.id);
                  setStatutPaiement(v.statut_paiement);
                }}
                className="text-xs font-semibold text-accent2 hover:text-accent"
              >
                Modifier le statut
              </button>
            )}
            <button
              type="button"
              onClick={() => supprimer(v.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {(modification.erreur || suppression.erreur) ? (
        <p className="mt-2 text-xs font-semibold text-red-400">{modification.erreur ?? suppression.erreur}</p>
      ) : null}
    </div>
  );
}
