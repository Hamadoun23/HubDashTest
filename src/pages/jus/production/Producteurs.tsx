import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../../components/ui/FormulaireEtHistorique';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { creerProducteur, listerProducteurs, modifierProducteur, supprimerProducteur, type TypeProd } from '../../../lib/api/jus';

export default function Producteurs() {
  const producteurs = useApi(() => listerProducteurs(), []);
  const creation = useAction(creerProducteur);
  const modification = useAction(modifierProducteur);
  const suppression = useAction(supprimerProducteur);

  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [nom, setNom] = useState('');
  const [type, setType] = useState<TypeProd>('INTERNE');
  const [zone, setZone] = useState('');
  const [contact, setContact] = useState('');

  function reinitialiser() {
    setIdEnEdition(null);
    setNom('');
    setType('INTERNE');
    setZone('');
    setContact('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = { nom_complet: nom, type_prod: type, zone, contact };
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, payload);
    } else {
      await creation.executer(payload);
    }
    reinitialiser();
    producteurs.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement ce producteur ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) reinitialiser();
    producteurs.recharger();
  }

  return producteurs.erreur ? (
    <EtatErreur message={producteurs.erreur} recharger={producteurs.recharger} />
  ) : (
    <div>
      {idEnEdition !== null && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent2">
          <span>Modification du producteur en cours</span>
          <button type="button" onClick={reinitialiser} className="font-semibold text-white hover:text-accent">
            Annuler la modification
          </button>
        </div>
      )}
      <FormulaireEtHistorique
        icon={UserRound}
        titre="Producteurs"
        sousTitre="Coopératives et producteurs partenaires"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours || modification.enCours}
        erreurEnvoi={creation.erreur ?? modification.erreur}
        texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Ajouter le producteur'}
        champs={[
          { label: 'Nom', placeholder: 'Coopérative Sikasso', valeur: nom, onChange: setNom, requis: true },
          {
            label: 'Type',
            valeur: type,
            onChange: (v) => setType(v as TypeProd),
            requis: true,
            options: [
              { valeur: 'INTERNE', libelle: 'Interne' },
              { valeur: 'EXTERNE', libelle: 'Externe' },
            ],
          },
          { label: 'Zone', placeholder: 'Sikasso', valeur: zone, onChange: setZone, requis: true },
          { label: 'Contact', placeholder: '+223 ...', valeur: contact, onChange: setContact, requis: true },
        ]}
        colonnesHistorique={['Nom', 'Type', 'Zone', 'Contact', '']}
        lignesHistorique={(producteurs.donnees ?? []).map((p) => [
          p.nom_complet,
          p.type_prod_display,
          p.zone,
          p.contact,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(p.id);
                setNom(p.nom_complet);
                setType(p.type_prod);
                setZone(p.zone);
                setContact(p.contact);
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => supprimer(p.id)}
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
