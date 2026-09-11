import { useState } from 'react';
import { Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui-light/EtatRequete';
import { PageHeader } from '../../../components/ui-light/PageHeader';
import { RapportGenerique } from '../../../components/ui-light/RapportGenerique';
import { useApi } from '../../../lib/hooks/useApi';
import { exporterRapport, obtenirRapport, type ModuleReporting } from '../../../lib/api/jus';

const PERIODES = [
  { valeur: 'semaine', libelle: 'Cette semaine' },
  { valeur: 'mois', libelle: 'Ce mois' },
  { valeur: 'trimestre', libelle: 'Ce trimestre' },
] as const;

export function EcranRapportModule({
  module,
  icon,
  titre,
  sousTitre,
}: {
  module: ModuleReporting;
  icon: LucideIcon;
  titre: string;
  sousTitre: string;
}) {
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]['valeur']>('mois');
  const rapport = useApi(() => obtenirRapport(module, { periode }), [module, periode]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader icon={icon} titre={titre} sousTitre={sousTitre} accent="#eb6834" />
        <div className="mb-6 flex items-center gap-2">
          <select
            value={periode}
            onChange={(e) => setPeriode(e.target.value as (typeof PERIODES)[number]['valeur'])}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-jus-primary focus:outline-none"
          >
            {PERIODES.map((p) => (
              <option key={p.valeur} value={p.valeur}>
                {p.libelle}
              </option>
            ))}
          </select>
          <button
            onClick={() => exporterRapport(module, { periode })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:border-jus-primary"
          >
            <Download size={13} /> Exporter
          </button>
        </div>
      </div>

      {rapport.chargement ? (
        <EtatChargement texte="Chargement du rapport…" />
      ) : rapport.erreur || !rapport.donnees ? (
        <EtatErreur message={rapport.erreur ?? 'Indisponible'} recharger={rapport.recharger} />
      ) : (
        <RapportGenerique donnees={rapport.donnees} accent="#eb6834" />
      )}
    </div>
  );
}
