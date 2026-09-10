import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../../components/ui/FormulaireEtHistorique';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { creerCueillette, listerCueillettes, listerProducteurs, modifierCueillette, supprimerCueillette } from '../../../lib/api/jus';

export default function Cueillettes() {
  const cueillettes = useApi(() => listerCueillettes(), []);
  const producteurs = useApi(() => listerProducteurs(), []);
  const creation = useAction(creerCueillette);
  const modification = useAction(modifierCueillette);
  const suppression = useAction(supprimerCueillette);

  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [producteurId, setProducteurId] = useState('');
  const [date, setDate] = useState('');
  const [qteTotal, setQteTotal] = useState('');
  const [qteBon, setQteBon] = useState('');

  function reinitialiser() {
    setIdEnEdition(null);
    setProducteurId('');
    setDate('');
    setQteTotal('');
    setQteBon('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      producteur: Number(producteurId),
      date_cueil: date,
      qte_total: Number(qteTotal),
      qte_bon: Number(qteBon),
    };
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, payload);
    } else {
      await creation.executer(payload);
    }
    reinitialiser();
    cueillettes.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cette cueillette ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) reinitialiser();
    cueillettes.recharger();
  }

  const producteursInternes = (producteurs.donnees ?? []).filter((p) => p.type_prod === 'INTERNE');

  return cueillettes.erreur ? (
    <EtatErreur message={cueillettes.erreur} recharger={cueillettes.recharger} />
  ) : (
    <div>
      {idEnEdition !== null && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent2">
          <span>Modification de la cueillette en cours</span>
          <button type="button" onClick={reinitialiser} className="font-semibold text-white hover:text-accent">
            Annuler la modification
          </button>
        </div>
      )}
      <FormulaireEtHistorique
        icon={Sprout}
        titre="Cueillettes"
        sousTitre="Enregistrer une cueillette"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours || modification.enCours}
        erreurEnvoi={creation.erreur ?? modification.erreur}
        texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Enregistrer la cueillette'}
        champs={[
          {
            label: 'Producteur',
            valeur: producteurId,
            onChange: setProducteurId,
            requis: true,
            options: producteursInternes.map((p) => ({ valeur: String(p.id), libelle: p.nom_complet })),
          },
          { label: 'Date', type: 'date', valeur: date, onChange: setDate, requis: true },
          { label: 'Quantité totale (kg)', placeholder: '600', valeur: qteTotal, onChange: setQteTotal, requis: true },
          { label: 'Quantité bonne (kg)', placeholder: '560', valeur: qteBon, onChange: setQteBon, requis: true },
        ]}
        colonnesHistorique={['Producteur', 'Quantité', 'Qualité', 'Date', '']}
        lignesHistorique={(cueillettes.donnees ?? []).map((c) => [
          c.producteur_display,
          `${c.qte_total} kg`,
          `${c.taux_qualite}%`,
          c.date_cueil,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(c.id);
                setProducteurId(String(c.producteur));
                setDate(c.date_cueil);
                setQteTotal(String(c.qte_total));
                setQteBon(String(c.qte_bon));
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
