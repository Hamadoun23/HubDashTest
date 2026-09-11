import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { PageHeader } from './PageHeader';
import { TableVirtus } from './Table';

type Champ = {
  label: string;
  type?: string;
  placeholder?: string;
  valeur?: string;
  onChange?: (valeur: string) => void;
  requis?: boolean;
  options?: { valeur: string; libelle: string }[];
};

export function FormulaireEtHistorique({
  icon,
  titre,
  sousTitre,
  champs,
  colonnesHistorique,
  lignesHistorique,
  onSubmit,
  envoiEnCours,
  erreurEnvoi,
  texteBouton = 'Envoyer la demande',
  entete,
  accent = '#334155',
}: {
  icon: LucideIcon;
  titre: string;
  sousTitre: string;
  champs: Champ[];
  colonnesHistorique: string[];
  lignesHistorique: React.ReactNode[][];
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  envoiEnCours?: boolean;
  erreurEnvoi?: string | null;
  texteBouton?: string;
  entete?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div>
      <PageHeader icon={icon} titre={titre} sousTitre={sousTitre} accent={accent} />

      <div className="grid grid-cols-[1fr_1.6fr] gap-6">
        <Card>
          <h2 className="text-sm font-bold text-slate-900">Nouvelle demande</h2>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={
              onSubmit ??
              ((e) => {
                e.preventDefault();
              })
            }
          >
            {champs.map((champ) => (
              <div key={champ.label}>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  {champ.label}
                  {champ.requis ? <span style={{ color: accent }}> *</span> : null}
                </label>
                {champ.options ? (
                  <select
                    value={champ.valeur}
                    onChange={champ.onChange ? (e) => champ.onChange!(e.target.value) : undefined}
                    required={champ.requis}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                    style={{ borderColor: undefined }}
                  >
                    <option value="">Sélectionner...</option>
                    {champ.options.map((option) => (
                      <option key={option.valeur} value={option.valeur}>
                        {option.libelle}
                      </option>
                    ))}
                  </select>
                ) : champ.type === 'textarea' ? (
                  <textarea
                    placeholder={champ.placeholder}
                    rows={3}
                    value={champ.valeur}
                    onChange={champ.onChange ? (e) => champ.onChange!(e.target.value) : undefined}
                    required={champ.requis}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                ) : (
                  <input
                    type={champ.type ?? 'text'}
                    placeholder={champ.placeholder}
                    value={champ.valeur}
                    onChange={champ.onChange ? (e) => champ.onChange!(e.target.value) : undefined}
                    required={champ.requis}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                )}
              </div>
            ))}
            {erreurEnvoi ? <p className="text-xs font-semibold text-rose-600">{erreurEnvoi}</p> : null}
            <button
              type="submit"
              disabled={envoiEnCours}
              className="mt-1 rounded-xl px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: accent }}
            >
              {envoiEnCours ? 'Envoi...' : texteBouton}
            </button>
          </form>
        </Card>

        <div>
          {entete}
          <h2 className="mb-3 text-sm font-bold text-slate-900">Mes demandes précédentes</h2>
          <TableVirtus colonnes={colonnesHistorique} lignes={lignesHistorique} />
        </div>
      </div>
    </div>
  );
}
