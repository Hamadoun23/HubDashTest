import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { Badge, TableVirtus } from '../../components/ui-light/Table';
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
      <PageHeader icon={ClipboardList} titre="À valider" sousTitre="Dossiers attendant votre décision" accent="#d03e0d" />

      {liste.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
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
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rh-marque500 focus:outline-none"
                />
                <button
                  onClick={() => confirmerRejet(dossier.id)}
                  disabled={rejet.enCours || !commentaireRejet.trim()}
                  className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 disabled:opacity-50"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => {
                    setDossierEnRejet(null);
                    setCommentaireRejet('');
                  }}
                  className="text-xs text-slate-500"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => approuver(dossier.id)}
                  disabled={validation.enCours}
                  className="rounded-lg bg-rh-marque500 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50"
                >
                  Approuver
                </button>
                <button
                  onClick={() => setDossierEnRejet(dossier.id)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500"
                >
                  Refuser
                </button>
              </div>
            ),
          ])}
        />
      )}

      {(validation.erreur || rejet.erreur) && (
        <p className="mt-3 text-xs font-semibold text-rose-600">{validation.erreur ?? rejet.erreur}</p>
      )}
    </div>
  );
}
