import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus, X } from 'lucide-react';
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

/** La liste (table) est ce qu'on voit en arrivant sur l'onglet ; le
 * formulaire ne s'ouvre qu'au clic sur le bouton d'action, en recouvrement —
 * pas les deux affichés en permanence côte à côte. */
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
  texteAction = 'Nouvelle demande',
  enEdition = false,
  onFermer,
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
  /** Libellé du bouton qui ouvre le formulaire. */
  texteAction?: string;
  /** Le parent édite une entrée existante : force l'ouverture du formulaire. */
  enEdition?: boolean;
  /** Appelé à la fermeture (croix ou après envoi réussi) — le parent y remet ses champs à zéro / annule son édition. */
  onFermer?: () => void;
}) {
  const [ouvertManuel, setOuvertManuel] = useState(false);
  const ouvert = ouvertManuel || enEdition;
  const enCoursPrecedent = useRef(envoiEnCours);

  useEffect(() => {
    if (enCoursPrecedent.current && !envoiEnCours && !erreurEnvoi) {
      setOuvertManuel(false);
    }
    enCoursPrecedent.current = envoiEnCours;
  }, [envoiEnCours, erreurEnvoi]);

  function fermer() {
    setOuvertManuel(false);
    onFermer?.();
  }

  return (
    <div>
      <PageHeader
        icon={icon}
        titre={titre}
        sousTitre={sousTitre}
        action={
          <button
            onClick={() => setOuvertManuel(true)}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-black"
          >
            <Plus size={14} /> {texteAction}
          </button>
        }
      />

      {lignesHistorique.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">Rien pour le moment.</p>
      ) : (
        <TableVirtus colonnes={colonnesHistorique} lignes={lignesHistorique} />
      )}

      {ouvert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg !bg-surface">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{enEdition ? 'Modifier' : texteAction}</h2>
              <button onClick={fermer} className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form
              className="flex flex-col gap-3"
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
        </div>
      ) : null}
    </div>
  );
}
