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
  /** Libellé du bouton qui ouvre le formulaire. */
  texteAction?: string;
  /** Le parent édite une entrée existante : force l'ouverture du formulaire. */
  enEdition?: boolean;
  /** Appelé à la fermeture (croix ou après envoi réussi) — le parent y remet ses champs à zéro / annule son édition. */
  onFermer?: () => void;
  accent?: string;
}) {
  const [ouvertManuel, setOuvertManuel] = useState(false);
  const ouvert = ouvertManuel || enEdition;
  const enCoursPrecedent = useRef(envoiEnCours);

  useEffect(() => {
    // Un envoi qui vient de se terminer sans erreur ferme le formulaire.
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
        accent={accent}
        action={
          <button
            onClick={() => setOuvertManuel(true)}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white"
            style={{ background: accent }}
          >
            <Plus size={14} /> {texteAction}
          </button>
        }
      />

      {lignesHistorique.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Rien pour le moment.</p>
      ) : (
        <TableVirtus colonnes={colonnesHistorique} lignes={lignesHistorique} />
      )}

      {ouvert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-lg !bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">{enEdition ? 'Modifier' : texteAction}</h2>
              <button onClick={fermer} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
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
        </div>
      ) : null}
    </div>
  );
}
