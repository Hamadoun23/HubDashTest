import { Building2, Check, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { choisirPartenaire, obtenirChoixClient, type PartenaireChoix } from '../../lib/api/campagnes';

function CarteClient({ partenaire, courant, onChoisir, enCours }: { partenaire: PartenaireChoix; courant: boolean; onChoisir: () => void; enCours: boolean }) {
  const parAgences = partenaire.organisation === 'agences';

  return (
    <button
      type="button"
      onClick={onChoisir}
      disabled={enCours}
      className={`group relative flex w-full flex-col items-start gap-4 rounded-2xl border p-6 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60 ${
        courant ? 'border-accent bg-accent/10 ring-2 ring-accent/30' : 'border-border bg-surface2 hover:border-accent2/40'
      }`}
    >
      {courant && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-black">
          <Check size={14} strokeWidth={3} />
        </span>
      )}

      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-lg font-bold uppercase text-accent2">
        {partenaire.code}
      </span>

      <div className="min-w-0">
        <p className="text-lg font-semibold text-white">{partenaire.nom}</p>
        {partenaire.nom_complet && <p className="mt-0.5 text-sm text-muted">{partenaire.nom_complet}</p>}
      </div>

      <dl className="flex w-full flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted">
          {parAgences ? <Building2 size={15} /> : <Users size={15} />}
          <span className="font-medium text-white">{parAgences ? partenaire.agences : partenaire.commerciaux}</span>
          <span>{parAgences ? 'agences' : 'commerciaux'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <span className="font-medium text-white">{partenaire.campagnes_actives}</span>
          <span>{partenaire.campagnes_actives > 1 ? 'campagnes actives' : 'campagne active'}</span>
        </div>
      </dl>
    </button>
  );
}

export default function ChoixClient() {
  const choix = useApi(obtenirChoixClient, []);
  const selection = useAction(choisirPartenaire);
  const navigate = useNavigate();

  if (choix.chargement) return <EtatChargement texte="Chargement des clients…" />;
  if (choix.erreur || !choix.donnees) return <EtatErreur message={choix.erreur ?? 'Indisponible'} recharger={choix.recharger} />;

  const c = choix.donnees;

  async function choisir(id: number) {
    await selection.executer(id);
    navigate('/campagnes');
  }

  return (
    <div>
      <PageHeader icon={Building2} titre="Pour quel client travaillez-vous ?" sousTitre="GDA pilote les campagnes de vente de cartes pour plusieurs banques" />

      <p className="mb-6 max-w-xl text-sm text-muted">
        Le client sélectionné détermine les campagnes, les commerciaux et les rapports que vous consultez. Vous pourrez en changer à tout
        moment.
      </p>

      {selection.erreur && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">{selection.erreur}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {c.partenaires.map((p) => (
          <CarteClient key={p.id} partenaire={p} courant={p.id === c.courantId} onChoisir={() => choisir(p.id)} enCours={selection.enCours} />
        ))}
      </div>

      {c.partenaires.length === 0 && (
        <Card className="mt-8 border-dashed text-center text-sm text-muted">Aucun client actif n'est configuré.</Card>
      )}
    </div>
  );
}
