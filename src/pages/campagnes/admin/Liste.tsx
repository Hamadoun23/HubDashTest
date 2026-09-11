import { Clapperboard, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EtatChargement, EtatErreur } from '../../../components/ui-light/EtatRequete';
import { PageHeader } from '../../../components/ui-light/PageHeader';
import { Badge, TableVirtus } from '../../../components/ui-light/Table';
import { useApi } from '../../../lib/hooks/useApi';
import { listerCampagnesAdmin, type StatutCampagne } from '../../../lib/api/campagnes';

const TONE: Record<StatutCampagne, 'success' | 'warning' | 'danger' | 'neutral'> = {
  en_cours: 'success',
  programmee: 'warning',
  terminee: 'neutral',
  arretee: 'danger',
  annulee: 'danger',
};

const LIBELLE_TYPE: Record<string, string> = { vente_carte: 'Vente de cartes', enrolement_app: "Enrôlement à l'application" };

export default function Liste() {
  const campagnes = useApi(listerCampagnesAdmin, []);

  if (campagnes.chargement) return <EtatChargement texte="Chargement des campagnes…" />;
  if (campagnes.erreur) return <EtatErreur message={campagnes.erreur} recharger={campagnes.recharger} />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader icon={Clapperboard} titre="Campagnes" sousTitre="Toutes les campagnes du partenaire" accent="#7c3aed" />
        <Link
          to="/campagnes/admin/campagnes/creer"
          className="mb-6 flex h-fit items-center gap-2 rounded-xl bg-campagnes-primary px-4 py-2.5 text-xs font-bold text-white"
        >
          <Plus size={14} />
          Nouvelle campagne
        </Link>
      </div>
      <TableVirtus
        colonnes={['Nom', 'Type', 'Période', 'Statut', '']}
        lignes={(campagnes.donnees ?? []).map((c) => [
          c.nom,
          LIBELLE_TYPE[c.type] ?? c.type,
          `${c.date_debut} → ${c.date_fin}`,
          <Badge tone={TONE[c.statut]}>{c.statut}</Badge>,
          <Link to={`/campagnes/admin/campagnes/${c.id}`} className="text-xs font-semibold text-campagnes-primaryDark">
            Voir le détail →
          </Link>,
        ])}
      />
    </div>
  );
}
