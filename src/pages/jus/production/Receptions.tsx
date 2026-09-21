import { useState } from 'react';
import { PackageOpen } from 'lucide-react';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../../components/ui/FormulaireEtHistorique';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { creerReception, listerReceptions, obtenirOptions, supprimerReception } from '../../../lib/api/jus';

const TONE = { EXCELLENT: 'success', BON: 'success', MAUVAIS: 'danger' } as const;

export default function Receptions() {
  const receptions = useApi(() => listerReceptions(), []);
  const options = useApi(() => obtenirOptions(), []);
  const creation = useAction(creerReception);
  // Pas de modifierReception distinct : une réception a peu de champs modifiables
  // une fois créée (contrôle qualité déjà fait), donc seule la suppression a du sens ici.
  const suppression = useAction(supprimerReception);

  const [cueilletteId, setCueilletteId] = useState('');
  const [date, setDate] = useState('');
  const [qteRecue, setQteRecue] = useState('');
  const [qteBon, setQteBon] = useState('');
  const [lieuDepot, setLieuDepot] = useState('');

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer({
      cueillette: Number(cueilletteId),
      date_recp: date,
      qte_recue: Number(qteRecue),
      qte_bon: Number(qteBon),
      lieu_depot: lieuDepot,
    });
    setDate('');
    setQteRecue('');
    setQteBon('');
    setLieuDepot('');
    receptions.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cette réception ?')) return;
    await suppression.executer(id);
    receptions.recharger();
  }

  return receptions.erreur ? (
    <EtatErreur message={receptions.erreur} recharger={receptions.recharger} />
  ) : (
    <div>
      <FormulaireEtHistorique
        icon={PackageOpen}
        titre="Réceptions"
        sousTitre="Contrôle qualité à l'arrivée"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours}
        erreurEnvoi={creation.erreur}
        texteBouton="Enregistrer la réception"
        champs={[
          {
            label: 'Cueillette',
            valeur: cueilletteId,
            onChange: setCueilletteId,
            requis: true,
            options: (options.donnees?.cueillettes_disponibles ?? []).map((c) => ({
              valeur: String(c.value),
              libelle: `${c.label} (${c.restant} kg restants)`,
            })),
          },
          { label: 'Date', type: 'date', valeur: date, onChange: setDate, requis: true },
          { label: 'Quantité reçue (kg)', placeholder: '580', valeur: qteRecue, onChange: setQteRecue, requis: true },
          { label: 'Quantité bonne (kg)', placeholder: '550', valeur: qteBon, onChange: setQteBon, requis: true },
          { label: 'Lieu de dépôt', placeholder: 'Entrepôt Bamako', valeur: lieuDepot, onChange: setLieuDepot, requis: true },
        ]}
        colonnesHistorique={['Référence', 'Origine', 'Quantité', 'Qualité', '']}
        lignesHistorique={(receptions.donnees ?? []).map((r) => [
          r.num_recp,
          r.cueillette_display,
          `${r.qte_recue} kg`,
          <Badge tone={TONE[r.etat_qualite]}>{r.etat_qualite}</Badge>,
          <button
            type="button"
            onClick={() => supprimer(r.id)}
            disabled={suppression.enCours}
            className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            Supprimer
          </button>,
        ])}
      />
      {suppression.erreur ? <p className="mt-3 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}
    </div>
  );
}
