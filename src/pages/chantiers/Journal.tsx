import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { useApi } from '../../lib/hooks/useApi';
import { listerJournal } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';

export default function Journal() {
  const { projet } = useOutletContext<ContexteChantier>();
  const journal = useApi(() => listerJournal(projet.id), [projet.id]);

  if (journal.chargement) return <EtatChargement texte="Chargement du journal…" />;
  if (journal.erreur || !journal.donnees) {
    return <EtatErreur message={journal.erreur ?? 'Journal indisponible'} recharger={journal.recharger} />;
  }

  const entrees = journal.donnees.logs;

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-sm font-bold text-chantiers-marron">Journal d'activité</h2>
      {entrees.length === 0 ? (
        <p className="text-xs text-slate-500">Aucune activité enregistrée pour ce chantier.</p>
      ) : (
        <div className="flex flex-col gap-4 border-l border-slate-200 pl-4">
          {entrees.map((entree) => (
            <div key={entree.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-chantiers-terracotta" />
              <p className="text-xs text-slate-500">
                {new Date(entree.created_at).toLocaleString('fr-FR')} · {entree.user_name}
              </p>
              <p className="mt-0.5 text-sm text-slate-700">{entree.description}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
