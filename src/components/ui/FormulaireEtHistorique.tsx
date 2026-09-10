import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { PageHeader } from './PageHeader';
import { TableVirtus } from './Table';

type Champ = {
  label: string;
  type?: string;
  placeholder?: string;
  /** Optionnels : passés, le champ devient contrôlé (valeur pilotée par le parent). */
  valeur?: string;
  onChange?: (valeur: string) => void;
  requis?: boolean;
  /** Si fourni, le champ devient un `<select>` plutôt qu'un `<input>`/`<textarea>`. */
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
}: {
  icon: LucideIcon;
  titre: string;
  sousTitre: string;
  champs: Champ[];
  colonnesHistorique: string[];
  lignesHistorique: React.ReactNode[][];
  /** Si fourni, le formulaire devient fonctionnel : soumission réelle vers l'API. */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  envoiEnCours?: boolean;
  erreurEnvoi?: string | null;
  texteBouton?: string;
  /** Contenu additionnel affiché au-dessus du tableau d'historique (ex. un indicateur). */
  entete?: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader icon={icon} titre={titre} sousTitre={sousTitre} />

      <div className="grid grid-cols-[1fr_1.6fr] gap-6">
        <Card>
          <h2 className="text-sm font-bold text-white">Nouvelle demande</h2>
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
                <label className="mb-1.5 block text-xs font-semibold text-muted">
                  {champ.label}
                  {champ.requis ? <span className="text-accent2"> *</span> : null}
                </label>
                {champ.options ? (
                  <select
                    value={champ.valeur}
                    onChange={champ.onChange ? (e) => champ.onChange!(e.target.value) : undefined}
                    required={champ.requis}
                    className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
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
                    className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                ) : (
                  <input
                    type={champ.type ?? 'text'}
                    placeholder={champ.placeholder}
                    value={champ.valeur}
                    onChange={champ.onChange ? (e) => champ.onChange!(e.target.value) : undefined}
                    required={champ.requis}
                    className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                )}
              </div>
            ))}
            {erreurEnvoi ? <p className="text-xs font-semibold text-red-400">{erreurEnvoi}</p> : null}
            <button
              type="submit"
              disabled={envoiEnCours}
              className="mt-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {envoiEnCours ? 'Envoi...' : texteBouton}
            </button>
          </form>
        </Card>

        <div>
          {entete}
          <h2 className="mb-3 text-sm font-bold text-white">Mes demandes précédentes</h2>
          <TableVirtus colonnes={colonnesHistorique} lignes={lignesHistorique} />
        </div>
      </div>
    </div>
  );
}
