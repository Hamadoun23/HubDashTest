import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { demandesAValider, rejeterDemande, validerDemande } from '../../lib/api/rh';

export default function Validations() {
  const dossiers = useApi(demandesAValider, []);
  const validation = useAction(validerDemande);
  const rejet = useAction(rejeterDemande);
  const [dossierEnRejet, setDossierEnRejet] = useState<number | null>(null);
  const [commentaireRejet, setCommentaireRejet] = useState('');

  if (dossiers.chargement) return <EtatChargement texte="Chargement des dossiers à valider…" />;
  if (dossiers.erreur) return <EtatErreur message={dossiers.erreur} recharger={dossiers.recharger} />;

  const liste = dossiers.donnees ?? [];

  async function approuver(id: number) {
    await validation.executer(id);
    dossiers.recharger();
  }

  async function confirmerRejet(id: number) {
    if (!commentaireRejet.trim()) return;
    await rejet.executer(id, commentaireRejet);
    setDossierEnRejet(null);
    setCommentaireRejet('');
    dossiers.recharger();
  }

  return (
    <div>
      <PageHeader icon={ClipboardList} titre="À valider" sousTitre="Dossiers attendant votre décision" />

      {liste.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted backdrop-blur-xl">
          Aucun dossier n'attend votre décision pour le moment.
        </p>
      ) : (
        <TableVirtus
          colonnes={['Référence', 'Collaborateur', 'Type', 'Étape', 'Statut', '']}
          lignes={liste.map((dossier) => [
            dossier.numero,
            dossier.demandeur_nom,
            dossier.type_absence_libelle,
            dossier.etape_courante_libelle,
            <Badge tone="warning">{dossier.statut_libelle}</Badge>,
            dossierEnRejet === dossier.id ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={commentaireRejet}
                  onChange={(e) => setCommentaireRejet(e.target.value)}
                  placeholder="Motif du rejet..."
                  className="rounded-lg border border-border bg-surface2 px-2 py-1 text-xs text-white placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => confirmerRejet(dossier.id)}
                  disabled={rejet.enCours || !commentaireRejet.trim()}
                  className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400 disabled:opacity-50"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => {
                    setDossierEnRejet(null);
                    setCommentaireRejet('');
                  }}
                  className="text-xs text-muted"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => approuver(dossier.id)}
                  disabled={validation.enCours}
                  className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black disabled:opacity-50"
                >
                  Approuver
                </button>
                <button
                  onClick={() => setDossierEnRejet(dossier.id)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted"
                >
                  Refuser
                </button>
              </div>
            ),
          ])}
        />
      )}

      {(validation.erreur || rejet.erreur) && (
        <p className="mt-3 text-xs font-semibold text-red-400">{validation.erreur ?? rejet.erreur}</p>
      )}
    </div>
  );
}
