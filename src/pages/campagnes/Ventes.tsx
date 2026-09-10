import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui/FormulaireEtHistorique';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerVente, listerVentes, optionsCreationVente } from '../../lib/api/campagnes';

export default function Ventes() {
  const ventes = useApi(() => listerVentes(), []);
  const options = useApi(optionsCreationVente, []);
  const creation = useAction(creerVente);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [typeCarteId, setTypeCarteId] = useState('');
  const [campagneId, setCampagneId] = useState('');

  const plusieursCampagnes = (options.donnees?.campagnes_ouvertes.length ?? 0) > 1;

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer({
      prenom,
      nom,
      telephone: telephone || undefined,
      type_carte_id: Number(typeCarteId),
      campagne_id: campagneId ? Number(campagneId) : undefined,
    });
    setPrenom('');
    setNom('');
    setTelephone('');
    ventes.recharger();
  }

  return ventes.erreur ? (
    <EtatErreur message={ventes.erreur} recharger={ventes.recharger} />
  ) : (
    <FormulaireEtHistorique
      icon={CreditCard}
      titre="Mes ventes"
      sousTitre={ventes.donnees?.libelleStatsCampagne ?? 'Enregistrer une vente de carte'}
      onSubmit={envoyer}
      envoiEnCours={creation.enCours}
      erreurEnvoi={creation.erreur}
      texteBouton="Enregistrer la vente"
      champs={[
        { label: 'Prénom du client', valeur: prenom, onChange: setPrenom, requis: true },
        { label: 'Nom du client', valeur: nom, onChange: setNom, requis: true },
        { label: 'Téléphone', valeur: telephone, onChange: setTelephone },
        {
          label: 'Type de carte',
          valeur: typeCarteId,
          onChange: setTypeCarteId,
          requis: true,
          options: (options.donnees?.types_cartes ?? []).map((t) => ({ valeur: String(t.id), libelle: t.code })),
        },
        ...(plusieursCampagnes
          ? [
              {
                label: 'Campagne',
                valeur: campagneId,
                onChange: setCampagneId,
                requis: true,
                options: (options.donnees?.campagnes_ouvertes ?? []).map((c) => ({ valeur: String(c.id), libelle: c.nom })),
              },
            ]
          : []),
      ]}
      colonnesHistorique={['Client', 'Type de carte', 'Date']}
      lignesHistorique={(ventes.donnees?.ventes.data ?? []).map((v) => [v.client_nom, v.type_carte, v.date])}
    />
  );
}
