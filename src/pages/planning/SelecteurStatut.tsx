import { useState } from 'react';
import { LIBELLES_STATUT, type StatutEvenement } from '../../lib/api/planning';

const CHAMP = 'w-full rounded-lg border border-border bg-surface2 px-2 py-1.5 text-xs text-white placeholder:text-muted focus:border-accent focus:outline-none';

// Miroir exact de STATUTS_NECESSITANT_RAISON côté backend (planning/models.py) :
// sans ce motif, l'appel est rejeté avec un 400 que ce composant évite en amont.
const NECESSITE_RAISON = new Set<StatutEvenement>(['not_realized', 'cancelled', 'rescheduled']);

/** Changer un statut vers "Non réalisé"/"Annulé"/"Reprogrammé" exige un motif
 * côté backend (et une nouvelle date pour "Reprogrammé") — un `<select>` nu
 * échoue silencieusement sur ces trois valeurs. On révèle un mini-formulaire
 * avant d'envoyer quoi que ce soit. */
export function SelecteurStatut({
  statutActuel,
  enCours,
  onChanger,
}: {
  statutActuel: StatutEvenement;
  enCours: boolean;
  onChanger: (statut: StatutEvenement, raison?: string, rescheduleDate?: string) => Promise<unknown>;
}) {
  const [enAttente, setEnAttente] = useState<StatutEvenement | null>(null);
  const [raison, setRaison] = useState('');
  const [nouvelleDate, setNouvelleDate] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  function annuler() {
    setEnAttente(null);
    setRaison('');
    setNouvelleDate('');
    setErreur(null);
  }

  async function choisir(valeur: StatutEvenement) {
    if (!valeur || valeur === statutActuel) return;
    if (NECESSITE_RAISON.has(valeur)) {
      setEnAttente(valeur);
      return;
    }
    await onChanger(valeur);
  }

  async function confirmer() {
    if (!enAttente) return;
    if (!raison.trim()) {
      setErreur('Le motif est obligatoire.');
      return;
    }
    if (enAttente === 'rescheduled' && !nouvelleDate) {
      setErreur('La nouvelle date est obligatoire.');
      return;
    }
    await onChanger(enAttente, raison.trim(), enAttente === 'rescheduled' ? nouvelleDate : undefined);
    annuler();
  }

  if (enAttente) {
    return (
      <div className="flex min-w-[200px] flex-col gap-1.5 rounded-lg border border-accent/30 bg-accent/10 p-2">
        <p className="text-[11px] font-semibold text-accent2">{LIBELLES_STATUT[enAttente]} — motif requis</p>
        <input value={raison} onChange={(e) => setRaison(e.target.value)} placeholder="Motif..." className={CHAMP} />
        {enAttente === 'rescheduled' && (
          <input type="datetime-local" value={nouvelleDate} onChange={(e) => setNouvelleDate(e.target.value)} className={CHAMP} />
        )}
        {erreur && <p className="text-[11px] font-semibold text-red-400">{erreur}</p>}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={confirmer}
            disabled={enCours}
            className="rounded-lg bg-accent px-2 py-1 text-[11px] font-bold text-black disabled:opacity-50"
          >
            Confirmer
          </button>
          <button type="button" onClick={annuler} className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted hover:text-white">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      value={statutActuel}
      disabled={enCours}
      onChange={(e) => choisir(e.target.value as StatutEvenement)}
      className="rounded-lg border border-border bg-surface2 px-2 py-1 text-xs text-white disabled:opacity-50"
    >
      {(Object.entries(LIBELLES_STATUT) as [StatutEvenement, string][]).map(([valeur, libelle]) => (
        <option key={valeur} value={valeur}>
          {libelle}
        </option>
      ))}
    </select>
  );
}

/** Distinct de `SelecteurStatut` (qui déplace l'événement en place) : ceci
 * crée un nouvel événement à la date choisie et marque l'ancien "Annulé" —
 * pour garder une trace plutôt que de la faire disparaître. Comportement
 * d'origine (`reschedule()` Laravel), voir `reprogrammerTournage`/
 * `reprogrammerPublication`. */
export function BoutonReprogrammer({ enCours, onReprogrammer }: { enCours: boolean; onReprogrammer: (nouvelleDate: string) => Promise<unknown> }) {
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState('');

  async function confirmer() {
    if (!date) return;
    await onReprogrammer(date);
    setOuvert(false);
    setDate('');
  }

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="text-xs font-semibold text-accent2 hover:text-white">
        Reprogrammer
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
      <button type="button" onClick={confirmer} disabled={!date || enCours} className="rounded-lg bg-accent px-2 py-1 text-[11px] font-bold text-black disabled:opacity-50">
        OK
      </button>
      <button
        type="button"
        onClick={() => {
          setOuvert(false);
          setDate('');
        }}
        className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted hover:text-white"
      >
        Annuler
      </button>
    </div>
  );
}
