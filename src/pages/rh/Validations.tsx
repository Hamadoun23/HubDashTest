import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { demandesAValider, rejeterDemande, validerDemande } from '../../lib/api/rh';
import { rejeterRequisition, requisitionsAValider, validerRequisition } from '../../lib/api/finance';

type DossierUnifie = {
  cle: string;
  id: number;
  source: 'absence' | 'requisition';
  numero: string;
  demandeur_nom: string;
  type: string;
  etape: string;
  statut_libelle: string;
};

export default function Validations() {
  const absences = useApi(demandesAValider, []);
  const requisitions = useApi(requisitionsAValider, []);
  const validationAbsence = useAction(validerDemande);
  const rejetAbsence = useAction(rejeterDemande);
  const validationRequisition = useAction(validerRequisition);
  const rejetRequisition = useAction(rejeterRequisition);
  const [dossierEnRejet, setDossierEnRejet] = useState<string | null>(null);
  const [commentaireRejet, setCommentaireRejet] = useState('');

  if (absences.chargement || requisitions.chargement) return <EtatChargement texte="Chargement des dossiers à valider…" />;
  if (absences.erreur) return <EtatErreur message={absences.erreur} recharger={absences.recharger} />;
  if (requisitions.erreur) return <EtatErreur message={requisitions.erreur} recharger={requisitions.recharger} />;

  const liste: DossierUnifie[] = [
    ...(absences.donnees ?? []).map((d) => ({
      cle: `absence-${d.id}`,
      id: d.id,
      source: 'absence' as const,
      numero: d.numero,
      demandeur_nom: d.demandeur_nom,
      type: d.type_absence_libelle,
      etape: d.etape_courante_libelle,
      statut_libelle: d.statut_libelle,
    })),
    ...(requisitions.donnees ?? []).map((r) => ({
      cle: `requisition-${r.id}`,
      id: r.id,
      source: 'requisition' as const,
      numero: r.numero,
      demandeur_nom: r.demandeur_nom,
      type: `Réquisition — ${r.objet}`,
      etape: r.etape_courante_libelle,
      statut_libelle: r.statut_libelle,
    })),
  ];

  function recharger() {
    absences.recharger();
    requisitions.recharger();
  }

  async function approuver(dossier: DossierUnifie) {
    if (dossier.source === 'absence') await validationAbsence.executer(dossier.id);
    else await validationRequisition.executer(dossier.id);
    recharger();
  }

  async function confirmerRejet(dossier: DossierUnifie) {
    if (!commentaireRejet.trim()) return;
    if (dossier.source === 'absence') await rejetAbsence.executer(dossier.id, commentaireRejet);
    else await rejetRequisition.executer(dossier.id, commentaireRejet);
    setDossierEnRejet(null);
    setCommentaireRejet('');
    recharger();
  }

  const validation = { enCours: validationAbsence.enCours || validationRequisition.enCours, erreur: validationAbsence.erreur ?? validationRequisition.erreur };
  const rejet = { enCours: rejetAbsence.enCours || rejetRequisition.enCours, erreur: rejetAbsence.erreur ?? rejetRequisition.erreur };

  return (
    <div>
      <PageHeader icon={ClipboardList} titre="À valider" sousTitre="Dossiers attendant votre décision" />

      {liste.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">
          Aucun dossier n'attend votre décision pour le moment.
        </p>
      ) : (
        <TableVirtus
          colonnes={['Référence', 'Collaborateur', 'Type', 'Étape', 'Statut', '']}
          lignes={liste.map((dossier) => [
            dossier.source === 'requisition' ? (
              <Link to={`/rh/requisitions/${dossier.id}`} className="font-semibold text-white hover:text-accent2">
                {dossier.numero}
              </Link>
            ) : (
              dossier.numero
            ),
            dossier.demandeur_nom,
            dossier.type,
            dossier.etape,
            <Badge tone="warning">{dossier.statut_libelle}</Badge>,
            dossierEnRejet === dossier.cle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={commentaireRejet}
                  onChange={(e) => setCommentaireRejet(e.target.value)}
                  placeholder="Motif du rejet..."
                  className="rounded-lg border border-border bg-surface2 px-2 py-1 text-xs text-white placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => confirmerRejet(dossier)}
                  disabled={rejet.enCours || !commentaireRejet.trim()}
                  className="rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400 disabled:opacity-50"
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
                  onClick={() => approuver(dossier)}
                  disabled={validation.enCours}
                  className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black disabled:opacity-50"
                >
                  Approuver
                </button>
                <button
                  onClick={() => setDossierEnRejet(dossier.cle)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white"
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
