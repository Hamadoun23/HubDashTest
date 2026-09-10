import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../../components/ui/FormulaireEtHistorique';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { ajouterObservationInventaire, creerInventaire, listerInventaires, obtenirOptions, supprimerInventaire } from '../../../lib/api/jus';

const TONE = { BON: 'success', MOYEN: 'warning', MAUVAIS: 'danger' } as const;

export default function Inventaires() {
  const inventaires = useApi(() => listerInventaires(), []);
  const options = useApi(() => obtenirOptions(), []);
  const creation = useAction(creerInventaire);
  // Pas de modifierInventaire côté API (seule l'observation est modifiable, via un
  // endpoint dédié) : suppression + un petit panneau d'édition pour l'observation.
  const suppression = useAction(supprimerInventaire);
  const observationAction = useAction(ajouterObservationInventaire);

  const [articleId, setArticleId] = useState('');
  const [date, setDate] = useState('');
  const [qteDepot, setQteDepot] = useState('');

  const [idEnObservation, setIdEnObservation] = useState<number | null>(null);
  const [observation, setObservation] = useState('');

  async function enregistrerObservation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnObservation === null) return;
    await observationAction.executer(idEnObservation, observation);
    setIdEnObservation(null);
    setObservation('');
    inventaires.recharger();
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer({ article: Number(articleId), date_inv: date, qte_depot: Number(qteDepot) });
    setDate('');
    setQteDepot('');
    inventaires.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cet inventaire ?')) return;
    await suppression.executer(id);
    inventaires.recharger();
  }

  return inventaires.erreur ? (
    <EtatErreur message={inventaires.erreur} recharger={inventaires.recharger} />
  ) : (
    <div>
      <FormulaireEtHistorique
        icon={ClipboardList}
        titre="Inventaires"
        sousTitre="Comptages physiques"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours}
        erreurEnvoi={creation.erreur}
        texteBouton="Enregistrer le comptage"
        champs={[
          {
            label: 'Article',
            valeur: articleId,
            onChange: setArticleId,
            requis: true,
            options: (options.donnees?.articles ?? []).map((a) => ({ valeur: String(a.value), libelle: a.label })),
          },
          { label: 'Date', type: 'date', valeur: date, onChange: setDate, requis: true },
          { label: 'Quantité comptée', placeholder: '480', valeur: qteDepot, onChange: setQteDepot, requis: true },
        ]}
        colonnesHistorique={['Article', 'Date', 'Écart', 'Qualité', '']}
        lignesHistorique={(inventaires.donnees ?? []).map((i) => [
          i.article_display,
          i.date_inv,
          i.ecart,
          <Badge tone={TONE[i.qualite]}>{i.qualite}</Badge>,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnObservation(i.id);
                setObservation(i.observation);
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Observation
            </button>
            <button
              type="button"
              onClick={() => supprimer(i.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {suppression.erreur ? <p className="mt-3 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}

      {idEnObservation !== null && (
        <form onSubmit={enregistrerObservation} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-muted">Observation</label>
            <input
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={observationAction.enCours}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
          >
            {observationAction.enCours ? 'Envoi...' : 'Enregistrer'}
          </button>
          <button type="button" onClick={() => setIdEnObservation(null)} className="text-xs font-semibold text-muted hover:text-white">
            Annuler
          </button>
          {observationAction.erreur ? <p className="text-xs font-semibold text-red-400">{observationAction.erreur}</p> : null}
        </form>
      )}
    </div>
  );
}
