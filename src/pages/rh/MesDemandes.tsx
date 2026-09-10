import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui/FormulaireEtHistorique';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { annulerDemande, creerDemandeAbsence, mesDemandes, modifierDemandeAbsence, soumettreDemande } from '../../lib/api/rh';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROUVE: 'success',
  REJETE: 'danger',
  CLOTURE: 'success',
  EN_VALIDATION: 'warning',
  BROUILLON: 'neutral',
};

export default function MesDemandes() {
  const demandes = useApi(mesDemandes, []);
  const creation = useAction(creerDemandeAbsence);
  const modification = useAction(modifierDemandeAbsence);
  const soumission = useAction(soumettreDemande);
  const annulation = useAction(annulerDemande);

  const [type, setType] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [motif, setMotif] = useState('');
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);

  function modifier(d: NonNullable<typeof demandes.donnees>[number]) {
    setIdEnEdition(d.id);
    setType(d.type_absence_libelle);
    setDebut(d.date_debut);
    setFin(d.date_fin);
    setMotif(d.motif);
  }

  function annulerEdition() {
    setIdEnEdition(null);
    setType('');
    setDebut('');
    setFin('');
    setMotif('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, { type_absence: type, date_debut: debut, date_fin: fin || debut, motif });
      annulerEdition();
    } else {
      const creee = await creation.executer({ type_absence: type, date_debut: debut, date_fin: fin || debut, motif });
      await soumission.executer(creee.id);
      setType('');
      setDebut('');
      setFin('');
      setMotif('');
    }
    demandes.recharger();
  }

  return demandes.erreur ? (
    <EtatErreur message={demandes.erreur} recharger={demandes.recharger} />
  ) : (
    <FormulaireEtHistorique
      icon={ReceiptText}
      titre="Mes demandes"
      sousTitre={idEnEdition !== null ? 'Modifier la demande sélectionnée' : 'Toutes vos demandes RH, tous types confondus'}
      onSubmit={envoyer}
      envoiEnCours={creation.enCours || soumission.enCours || modification.enCours}
      erreurEnvoi={creation.erreur ?? soumission.erreur ?? modification.erreur}
      texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Envoyer la demande'}
      champs={[
        { label: 'Type de demande', placeholder: 'Congé annuel, Retard, Permission...', valeur: type, onChange: setType, requis: true },
        { label: 'Du', type: 'date', valeur: debut, onChange: setDebut, requis: true },
        { label: 'Au (si différent)', type: 'date', valeur: fin, onChange: setFin },
        { label: 'Motif', type: 'textarea', valeur: motif, onChange: setMotif, requis: true },
      ]}
      entete={
        idEnEdition !== null ? (
          <button onClick={annulerEdition} className="mb-3 text-xs font-semibold text-accent2 hover:text-accent">
            ← Annuler la modification
          </button>
        ) : undefined
      }
      colonnesHistorique={['Référence', 'Type', 'Période', 'Statut', '']}
      lignesHistorique={(demandes.donnees ?? []).map((d) => [
        d.numero,
        d.type_absence_libelle,
        d.date_debut === d.date_fin ? d.date_debut : `${d.date_debut} → ${d.date_fin}`,
        <Badge tone={TONE[d.statut] ?? 'neutral'}>{d.statut_libelle}</Badge>,
        d.modifiable ? (
          <div className="flex gap-2">
            <button onClick={() => modifier(d)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white">
              Modifier
            </button>
            <button
              onClick={() => annulation.executer(d.id).then(() => demandes.recharger())}
              disabled={annulation.enCours}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white"
            >
              Annuler
            </button>
          </div>
        ) : (
          ''
        ),
      ])}
    />
  );
}
