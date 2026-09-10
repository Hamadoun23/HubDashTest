import { useState } from 'react';
import { Package } from 'lucide-react';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../../components/ui/FormulaireEtHistorique';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  creerConditionnement,
  listerConditionnements,
  modifierConditionnement,
  obtenirOptions,
  supprimerConditionnement,
} from '../../../lib/api/jus';

export default function Conditionnements() {
  const conditionnements = useApi(() => listerConditionnements(), []);
  const options = useApi(() => obtenirOptions(), []);
  const creation = useAction(creerConditionnement);
  const modification = useAction(modifierConditionnement);
  const suppression = useAction(supprimerConditionnement);

  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [productionId, setProductionId] = useState('');
  const [date, setDate] = useState('');
  const [qte33, setQte33] = useState('');
  const [qte1l, setQte1l] = useState('');
  const [volumeUtilisee, setVolumeUtilisee] = useState('');
  const [observation, setObservation] = useState('');
  const [nbJours, setNbJours] = useState('90');

  function reinitialiser() {
    setIdEnEdition(null);
    setProductionId('');
    setDate('');
    setQte33('');
    setQte1l('');
    setVolumeUtilisee('');
    setObservation('');
    setNbJours('90');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      production: Number(productionId),
      date_cond: date,
      qte_33cl: qte33 ? Number(qte33) : undefined,
      qte_1l: qte1l ? Number(qte1l) : undefined,
      volume_utilisee: Number(volumeUtilisee),
      observation,
      nb_jours: Number(nbJours),
    };
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, payload);
    } else {
      await creation.executer(payload);
    }
    reinitialiser();
    conditionnements.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement ce conditionnement ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) reinitialiser();
    conditionnements.recharger();
  }

  return conditionnements.erreur ? (
    <EtatErreur message={conditionnements.erreur} recharger={conditionnements.recharger} />
  ) : (
    <div>
      {idEnEdition !== null && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent2">
          <span>Modification du conditionnement en cours</span>
          <button type="button" onClick={reinitialiser} className="font-semibold text-white hover:text-accent">
            Annuler la modification
          </button>
        </div>
      )}
      <FormulaireEtHistorique
        icon={Package}
        titre="Conditionnements"
        sousTitre="Mise en bouteille d'une production"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours || modification.enCours}
        erreurEnvoi={creation.erreur ?? modification.erreur}
        texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Enregistrer le conditionnement'}
        champs={[
          {
            label: 'Production',
            valeur: productionId,
            onChange: setProductionId,
            requis: true,
            options: (options.donnees?.productions_disponibles ?? []).map((p) => ({ valeur: String(p.value), libelle: p.label })),
          },
          { label: 'Date', type: 'date', valeur: date, onChange: setDate, requis: true },
          { label: 'Quantité 33cl', placeholder: '500', valeur: qte33, onChange: setQte33 },
          { label: 'Quantité 1L', placeholder: '200', valeur: qte1l, onChange: setQte1l },
          { label: 'Volume utilisé (L)', placeholder: '350', valeur: volumeUtilisee, onChange: setVolumeUtilisee, requis: true },
          { label: 'Durée de conservation (jours)', placeholder: '90', valeur: nbJours, onChange: setNbJours, requis: true },
          { label: 'Observation', type: 'textarea', valeur: observation, onChange: setObservation, requis: true },
        ]}
        colonnesHistorique={['Référence', 'Production', '33cl', '1L', 'DLC', '']}
        lignesHistorique={(conditionnements.donnees ?? []).map((c) => [
          c.numero_cond,
          c.production_numero,
          c.qte_33cl,
          c.qte_1l,
          c.dlc,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(c.id);
                setProductionId(String(c.production));
                setDate(c.date_cond);
                setQte33(String(c.qte_33cl));
                setQte1l(String(c.qte_1l));
                setVolumeUtilisee(String(c.volume_utilisee));
                setObservation(c.observation);
                setNbJours(c.nb_jours !== null ? String(c.nb_jours) : '90');
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => supprimer(c.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {suppression.erreur ? <p className="mt-3 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}
    </div>
  );
}
