import { useState } from 'react';
import { UserRound } from 'lucide-react';
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

export default function Permissions() {
  const demandes = useApi(mesDemandes, []);
  const creation = useAction(creerDemandeAbsence);
  const modification = useAction(modifierDemandeAbsence);
  const soumission = useAction(soumettreDemande);
  const annulation = useAction(annulerDemande);

  const [date, setDate] = useState('');
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [motif, setMotif] = useState('');
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);

  const permissions = (demandes.donnees ?? []).filter(
    (d) => d.categorie === 'PERMISSION' || d.type_absence_libelle.toLowerCase().includes('permission'),
  );

  function modifier(d: (typeof permissions)[number]) {
    setIdEnEdition(d.id);
    setDate(d.date_debut);
    setHeureDebut(d.heure_debut ?? '');
    setHeureFin(d.heure_fin ?? '');
    setMotif(d.motif);
  }

  function annulerEdition() {
    setIdEnEdition(null);
    setDate('');
    setHeureDebut('');
    setHeureFin('');
    setMotif('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, { date_debut: date, date_fin: date, heure_debut: heureDebut, heure_fin: heureFin, motif });
      annulerEdition();
    } else {
      const creee = await creation.executer({
        type_absence: 'Permission',
        date_debut: date,
        date_fin: date,
        demi_journee: true,
        heure_debut: heureDebut,
        heure_fin: heureFin,
        motif,
      });
      await soumission.executer(creee.id);
      setDate('');
      setHeureDebut('');
      setHeureFin('');
      setMotif('');
    }
    demandes.recharger();
  }

  return demandes.erreur ? (
    <EtatErreur message={demandes.erreur} recharger={demandes.recharger} />
  ) : (
    <FormulaireEtHistorique
      icon={UserRound}
      titre="Mes permissions"
      sousTitre={idEnEdition !== null ? 'Modifier la permission sélectionnée' : "S'absenter sans entamer son solde de congés"}
      onSubmit={envoyer}
      envoiEnCours={creation.enCours || soumission.enCours || modification.enCours}
      erreurEnvoi={creation.erreur ?? soumission.erreur ?? modification.erreur}
      texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Envoyer la demande'}
      champs={[
        { label: 'Date', type: 'date', valeur: date, onChange: setDate, requis: true },
        { label: 'De', type: 'time', valeur: heureDebut, onChange: setHeureDebut, requis: true },
        { label: 'À', type: 'time', valeur: heureFin, onChange: setHeureFin, requis: true },
        {
          label: 'Motif',
          type: 'textarea',
          placeholder: 'Rendez-vous médical, démarche administrative...',
          valeur: motif,
          onChange: setMotif,
          requis: true,
        },
      ]}
      entete={
        idEnEdition !== null ? (
          <button onClick={annulerEdition} className="mb-3 text-xs font-semibold text-accent2 hover:text-accent">
            ← Annuler la modification
          </button>
        ) : undefined
      }
      colonnesHistorique={['Référence', 'Date', 'Motif', 'Horaire', 'Statut', '']}
      lignesHistorique={permissions.map((d) => [
        d.numero,
        d.date_debut,
        d.motif,
        d.heure_debut && d.heure_fin ? `${d.heure_debut} → ${d.heure_fin}` : '—',
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
