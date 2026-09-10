import { useState } from 'react';
import { HardHat } from 'lucide-react';
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

export default function Retards() {
  const demandes = useApi(mesDemandes, []);
  const creation = useAction(creerDemandeAbsence);
  const modification = useAction(modifierDemandeAbsence);
  const soumission = useAction(soumettreDemande);
  const annulation = useAction(annulerDemande);

  const [date, setDate] = useState('');
  const [heureArrivee, setHeureArrivee] = useState('');
  const [motif, setMotif] = useState('');
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);

  const retards = (demandes.donnees ?? []).filter((d) => d.categorie === 'RETARD' || d.type_absence_libelle.toLowerCase().includes('retard'));

  function modifier(r: (typeof retards)[number]) {
    setIdEnEdition(r.id);
    setDate(r.date_debut);
    setHeureArrivee(r.heure_fin ?? '');
    setMotif(r.motif);
  }

  function annulerEdition() {
    setIdEnEdition(null);
    setDate('');
    setHeureArrivee('');
    setMotif('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, { date_debut: date, date_fin: date, heure_fin: heureArrivee, motif });
      annulerEdition();
    } else {
      const creee = await creation.executer({
        type_absence: 'Retard',
        date_debut: date,
        date_fin: date,
        demi_journee: true,
        heure_fin: heureArrivee,
        motif,
      });
      await soumission.executer(creee.id);
      setDate('');
      setHeureArrivee('');
      setMotif('');
    }
    demandes.recharger();
  }

  return demandes.erreur ? (
    <EtatErreur message={demandes.erreur} recharger={demandes.recharger} />
  ) : (
    <FormulaireEtHistorique
      icon={HardHat}
      titre="Signaler un retard"
      sousTitre={idEnEdition !== null ? 'Modifier le signalement sélectionné' : "Prévenir d'une arrivée tardive"}
      onSubmit={envoyer}
      envoiEnCours={creation.enCours || soumission.enCours || modification.enCours}
      erreurEnvoi={creation.erreur ?? soumission.erreur ?? modification.erreur}
      texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Envoyer la demande'}
      champs={[
        { label: 'Date', type: 'date', valeur: date, onChange: setDate, requis: true },
        { label: "Heure d'arrivée estimée", type: 'time', valeur: heureArrivee, onChange: setHeureArrivee, requis: true },
        { label: 'Motif', type: 'textarea', placeholder: 'Embouteillage, transport en commun...', valeur: motif, onChange: setMotif, requis: true },
      ]}
      entete={
        idEnEdition !== null ? (
          <button onClick={annulerEdition} className="mb-3 text-xs font-semibold text-accent2 hover:text-accent">
            ← Annuler la modification
          </button>
        ) : undefined
      }
      colonnesHistorique={['Référence', 'Date', 'Heure', 'Motif', 'Statut', '']}
      lignesHistorique={retards.map((r) => [
        r.numero,
        r.date_debut,
        r.heure_fin ?? '—',
        r.motif,
        <Badge tone={TONE[r.statut] ?? 'neutral'}>{r.statut_libelle}</Badge>,
        r.modifiable ? (
          <div className="flex gap-2">
            <button onClick={() => modifier(r)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white">
              Modifier
            </button>
            <button
              onClick={() => annulation.executer(r.id).then(() => demandes.recharger())}
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
