import { FileText } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { listerDemandesAbsence } from '../../lib/api/rh';

const TONE = { APPROUVE: 'success', REJETE: 'danger', CLOTURE: 'success' } as const;

export default function Historique() {
  const { donnees, chargement, erreur, recharger } = useApi(() => listerDemandesAbsence(), []);

  if (chargement) return <EtatChargement texte="Chargement de l'historique…" />;
  if (erreur) return <EtatErreur message={erreur} recharger={recharger} />;

  const decidees = (donnees ?? [])
    .filter((d) => d.statut === 'APPROUVE' || d.statut === 'REJETE' || d.statut === 'CLOTURE')
    .sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1));

  return (
    <div>
      <PageHeader icon={FileText} titre="Historique" sousTitre="Tout ce qui a été demandé et décidé" />
      {decidees.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted backdrop-blur-xl">
          Aucune décision enregistrée pour le moment.
        </p>
      ) : (
        <TableVirtus
          colonnes={['Référence', 'Collaborateur', 'Type', 'Période', 'Décision']}
          lignes={decidees.map((d) => [
            d.numero,
            d.demandeur_nom,
            d.type_absence_libelle,
            d.date_debut === d.date_fin ? d.date_debut : `${d.date_debut} → ${d.date_fin}`,
            <Badge tone={TONE[d.statut as keyof typeof TONE] ?? 'neutral'}>{d.statut_libelle}</Badge>,
          ])}
        />
      )}
    </div>
  );
}
