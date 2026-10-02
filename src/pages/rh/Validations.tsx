import { ChevronRight, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { demandesAValider } from '../../lib/api/rh';
import { requisitionsAValider } from '../../lib/api/finance';
import type { SourceDossier } from '../../lib/api/dossiers';

type DossierUnifie = {
  cle: string;
  id: number;
  source: SourceDossier;
  numero: string;
  demandeur_nom: string;
  type: string;
  etape: string;
  statut_libelle: string;
  en_attente: boolean;
};

/**
 * Dossiers qui attendent une décision. Un clic ouvre le détail
 * (DossierDetail) : contenu, circuit, échanges, versions — et c'est là que
 * l'on approuve, met en attente ou refuse, en connaissance de cause.
 */
export default function Validations() {
  const navigate = useNavigate();
  const absences = useApi(demandesAValider, []);
  const requisitions = useApi(requisitionsAValider, []);

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
      en_attente: Boolean(d.en_attente),
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
      en_attente: Boolean(r.en_attente),
    })),
  ];

  const ouvrir = (dossier: DossierUnifie) => navigate(`/rh/dossiers/${dossier.source}/${dossier.id}`);

  return (
    <div>
      <PageHeader icon={ClipboardList} titre="À valider" sousTitre="Dossiers attendant votre décision — cliquez pour ouvrir" />

      {liste.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">
          Aucun dossier n'attend votre décision pour le moment.
        </p>
      ) : (
        <TableVirtus
          colonnes={['Référence', 'Collaborateur', 'Type', 'Étape', 'Statut', '']}
          onRowClick={(index) => ouvrir(liste[index])}
          lignes={liste.map((dossier) => [
            <span className="font-semibold text-white">{dossier.numero}</span>,
            dossier.demandeur_nom,
            <span className="block max-w-[22rem] truncate" title={dossier.type}>
              {dossier.type}
            </span>,
            dossier.etape,
            dossier.en_attente ? <Badge tone="warning">En attente de complément</Badge> : <Badge>{dossier.statut_libelle}</Badge>,
            <span className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black">
              Ouvrir <ChevronRight size={13} />
            </span>,
          ])}
        />
      )}
    </div>
  );
}
