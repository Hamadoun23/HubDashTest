import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  completerProduction,
  creerProduction,
  listerProductions,
  modifierProduction,
  supprimerProduction,
  type Recette,
} from '../../../lib/api/jus';

const TONE: Record<string, 'success' | 'warning' | 'neutral'> = { TERMINEE: 'success', EN_COURS: 'warning' };

function FormulaireCompletion({ productionId, onTermine }: { productionId: number; onTermine: () => void }) {
  const completion = useAction(completerProduction);
  const [champs, setChamps] = useState({
    lavage_effectue: false,
    filtration_effectuee: false,
    pasteurisation_80c: false,
    test_qualite: false,
    eau_ajoutee_l: '',
    sucre_ajoute_kg: '',
    sorbate_ajoute_g: '',
    ph: '',
    refractometre: '',
    volume_final_l: '',
  });

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await completion.executer(productionId, {
      ...champs,
      eau_ajoutee_l: Number(champs.eau_ajoutee_l),
      sucre_ajoute_kg: Number(champs.sucre_ajoute_kg),
      sorbate_ajoute_g: Number(champs.sorbate_ajoute_g),
      ph: Number(champs.ph),
      refractometre: Number(champs.refractometre),
      volume_final_l: Number(champs.volume_final_l),
    });
    onTermine();
  }

  const champTexte = (cle: 'eau_ajoutee_l' | 'sucre_ajoute_kg' | 'sorbate_ajoute_g' | 'ph' | 'refractometre' | 'volume_final_l', label: string) => (
    <div key={cle}>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <input
        value={champs[cle]}
        onChange={(e) => setChamps((c) => ({ ...c, [cle]: e.target.value }))}
        required
        className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
      />
    </div>
  );

  const champCase = (cle: 'lavage_effectue' | 'filtration_effectuee' | 'pasteurisation_80c' | 'test_qualite', label: string) => (
    <label key={cle} className="flex items-center gap-2 text-xs text-white">
      <input
        type="checkbox"
        checked={champs[cle]}
        onChange={(e) => setChamps((c) => ({ ...c, [cle]: e.target.checked }))}
        className="h-3.5 w-3.5 rounded border-border bg-bg accent-accent"
      />
      {label}
    </label>
  );

  return (
    <form onSubmit={envoyer} className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4">
      <div className="grid grid-cols-3 gap-3">
        {champTexte('eau_ajoutee_l', "Eau ajoutée (L)")}
        {champTexte('sucre_ajoute_kg', 'Sucre ajouté (kg)')}
        {champTexte('sorbate_ajoute_g', 'Sorbate ajouté (g)')}
        {champTexte('ph', 'pH')}
        {champTexte('refractometre', 'Réfractomètre')}
        {champTexte('volume_final_l', 'Volume final (L)')}
      </div>
      <div className="flex flex-wrap gap-4">
        {champCase('lavage_effectue', 'Lavage effectué')}
        {champCase('filtration_effectuee', 'Filtration effectuée')}
        {champCase('pasteurisation_80c', 'Pasteurisation 80°C')}
        {champCase('test_qualite', 'Test qualité OK')}
      </div>
      {completion.erreur ? <p className="text-xs font-semibold text-red-400">{completion.erreur}</p> : null}
      <button
        type="submit"
        disabled={completion.enCours}
        className="w-fit rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
      >
        {completion.enCours ? 'Enregistrement...' : 'Marquer comme terminée'}
      </button>
    </form>
  );
}

export default function Productions() {
  const productions = useApi(() => listerProductions(), []);
  const creation = useAction(creerProduction);
  const modification = useAction(modifierProduction);
  const suppression = useAction(supprimerProduction);
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [recette, setRecette] = useState<Recette>('R80_20');
  const [enCompletion, setEnCompletion] = useState<number | null>(null);

  function reinitialiser() {
    setIdEnEdition(null);
    setDate('');
    setRecette('R80_20');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, { date_of: date, recette });
    } else {
      await creation.executer({ date_of: date, recette });
    }
    reinitialiser();
    productions.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cet ordre de fabrication ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) reinitialiser();
    productions.recharger();
  }

  if (productions.erreur) return <EtatErreur message={productions.erreur} recharger={productions.recharger} />;

  return (
    <div>
      <PageHeader icon={FlaskConical} titre="Productions" sousTitre="Ordres de fabrication" />

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">{idEnEdition !== null ? "Modifier l'ordre de fabrication" : 'Nouvel ordre de fabrication'}</h2>
          {idEnEdition !== null && (
            <button type="button" onClick={reinitialiser} className="text-xs font-semibold text-muted hover:text-white">
              Annuler la modification
            </button>
          )}
        </div>
        <form onSubmit={envoyer} className="mt-3 flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Recette</label>
            <select
              value={recette}
              onChange={(e) => setRecette(e.target.value as Recette)}
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            >
              <option value="R80_20">80/20</option>
              <option value="R75_25">75/25</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creation.enCours || modification.enCours}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
          >
            {creation.enCours || modification.enCours ? 'Envoi...' : idEnEdition !== null ? 'Mettre à jour' : 'Créer'}
          </button>
        </form>
        {(creation.erreur ?? modification.erreur) ? (
          <p className="mt-2 text-xs font-semibold text-red-400">{creation.erreur ?? modification.erreur}</p>
        ) : null}
      </Card>

      <TableVirtus
        colonnes={['Référence', 'Recette', 'Date', 'Statut', '']}
        lignes={(productions.donnees ?? []).map((p) => [
          p.numero_of,
          p.recette_display,
          p.date_of,
          <Badge tone={TONE[p.statut] ?? 'neutral'}>{p.statut_display}</Badge>,
          <div className="flex items-center gap-2">
            {p.statut !== 'TERMINEE' ? (
              <>
                <button
                  onClick={() => setEnCompletion(enCompletion === p.id ? null : p.id)}
                  className="text-xs font-semibold text-accent2 hover:text-accent"
                >
                  {enCompletion === p.id ? 'Fermer' : 'Compléter →'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdEnEdition(p.id);
                    setDate(p.date_of);
                    setRecette(p.recette);
                  }}
                  className="text-xs font-semibold text-accent2 hover:text-accent"
                >
                  Modifier
                </button>
              </>
            ) : null}
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
      {suppression.erreur ? <p className="mt-2 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}

      {enCompletion !== null && (
        <FormulaireCompletion
          productionId={enCompletion}
          onTermine={() => {
            setEnCompletion(null);
            productions.recharger();
          }}
        />
      )}
    </div>
  );
}
