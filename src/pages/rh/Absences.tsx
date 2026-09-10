import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui/FormulaireEtHistorique';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { annulerDemande, creerDemandeAbsence, mesDemandes, modifierDemandeAbsence, monSolde, soumettreDemande } from '../../lib/api/rh';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROUVE: 'success',
  REJETE: 'danger',
  CLOTURE: 'success',
  EN_VALIDATION: 'warning',
  BROUILLON: 'neutral',
};

export default function Absences() {
  const annee = new Date().getFullYear();
  const demandes = useApi(mesDemandes, []);
  const solde = useApi(() => monSolde(annee), [annee]);
  const creation = useAction(creerDemandeAbsence);
  const modification = useAction(modifierDemandeAbsence);
  const soumission = useAction(soumettreDemande);
  const annulation = useAction(annulerDemande);

  const [type, setType] = useState('Congé annuel');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [motif, setMotif] = useState('');
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);

  const conges = (demandes.donnees ?? []).filter((d) => d.categorie === 'CONGE' || d.type_absence_libelle.toLowerCase().includes('congé'));

  function modifier(d: (typeof conges)[number]) {
    setIdEnEdition(d.id);
    setType(d.type_absence_libelle);
    setDebut(d.date_debut);
    setFin(d.date_fin);
    setMotif(d.motif);
  }

  function annulerEdition() {
    setIdEnEdition(null);
    setType('Congé annuel');
    setDebut('');
    setFin('');
    setMotif('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, { type_absence: type, date_debut: debut, date_fin: fin, motif });
      annulerEdition();
    } else {
      const creee = await creation.executer({ type_absence: type, date_debut: debut, date_fin: fin, motif });
      await soumission.executer(creee.id);
      setDebut('');
      setFin('');
      setMotif('');
    }
    demandes.recharger();
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Card className="flex flex-1 items-center gap-4">
          {solde.donnees ? (
            <>
              <CircularProgress
                progress={(solde.donnees.jours_pris / (solde.donnees.jours_acquis + solde.donnees.jours_reportes || 1)) * 100}
                size={64}
                strokeWidth={6}
                gradientId="conges-gradient"
                label={`${solde.donnees.jours_restants}j`}
              />
              <div>
                <p className="text-sm font-semibold text-white">
                  {solde.donnees.jours_restants} jours restants sur {solde.donnees.jours_acquis + solde.donnees.jours_reportes}
                </p>
                <p className="text-xs text-muted">{solde.donnees.jours_pris} jours déjà pris cette année</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">{solde.chargement ? 'Chargement du solde…' : 'Solde indisponible'}</p>
          )}
        </Card>
      </div>

      {demandes.erreur ? (
        <EtatErreur message={demandes.erreur} recharger={demandes.recharger} />
      ) : (
        <FormulaireEtHistorique
          icon={Calendar}
          titre="Mes congés"
          sousTitre={idEnEdition !== null ? 'Modifier la demande sélectionnée' : 'Poser des jours sur son solde annuel'}
          onSubmit={envoyer}
          envoiEnCours={creation.enCours || soumission.enCours || modification.enCours}
          erreurEnvoi={creation.erreur ?? soumission.erreur ?? modification.erreur}
          texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Envoyer la demande'}
          champs={[
            { label: 'Type de congé', placeholder: 'Congé annuel', valeur: type, onChange: setType, requis: true },
            { label: 'Du', type: 'date', valeur: debut, onChange: setDebut, requis: true },
            { label: 'Au', type: 'date', valeur: fin, onChange: setFin, requis: true },
            { label: 'Motif (optionnel)', type: 'textarea', placeholder: 'Précisez si besoin...', valeur: motif, onChange: setMotif },
          ]}
          entete={
            idEnEdition !== null ? (
              <button onClick={annulerEdition} className="mb-3 text-xs font-semibold text-accent2 hover:text-accent">
                ← Annuler la modification
              </button>
            ) : undefined
          }
          colonnesHistorique={['Référence', 'Période', 'Type', 'Statut', '']}
          lignesHistorique={conges.map((d) => [
            d.numero,
            `${d.date_debut} → ${d.date_fin}`,
            d.type_absence_libelle,
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
      )}
    </div>
  );
}
