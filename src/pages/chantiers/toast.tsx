import { useCallback, useEffect, useRef, useState } from 'react';

/** Notification « toast » de daily.gdamali.net (`toast()` dans gda-app.js) :
 * même classe CSS, disparaît après 3,5 s. */
export function useToast() {
  const [etat, setEtat] = useState<{ message: string; type: '' | 'ok' | 'err'; visible: boolean }>({ message: '', type: '', visible: false });
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback((message: string, type: '' | 'ok' | 'err' = '') => {
    clearTimeout(minuteur.current);
    setEtat({ message, type, visible: true });
    minuteur.current = setTimeout(() => setEtat((e) => ({ ...e, visible: false })), 3500);
  }, []);

  useEffect(() => () => clearTimeout(minuteur.current), []);

  const element = <div className={`toast${etat.visible ? ' show' : ''}${etat.type ? ` ${etat.type}` : ''}`}>{etat.message}</div>;
  return { toast, element };
}

export const LIBELLE_STATUT: Record<string, string> = {
  non_demarre: 'Non démarré',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulée',
};

export const BADGE_STATUT: Record<string, string> = {
  non_demarre: 'badge-nd',
  en_cours: 'badge-ip',
  termine: 'badge-ok',
  annule: 'badge-late',
};

export function statutDepuisProgression(p: number): string {
  if (p >= 100) return 'termine';
  if (p > 0) return 'en_cours';
  return 'non_demarre';
}

export function classeBarre(p: number, avecMilieu = false): string {
  if (p === 100) return 'fill-done';
  if (avecMilieu && p > 50) return 'fill-mid';
  if (p > 0) return 'fill-low';
  return 'fill-0';
}

/** Date de début d'une tâche = début du projet + (start_day - 1) jours. */
export function dateDebutTache(debutProjet: string | null, startDay: number | null): string {
  const base = debutProjet ? new Date(`${debutProjet}T12:00:00`) : new Date();
  base.setDate(base.getDate() + Math.max(0, Number(startDay || 1) - 1));
  return base.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
