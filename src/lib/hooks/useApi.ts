import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

function messageErreur(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Une erreur est survenue';
}

/** Charge des données au montage (et à chaque changement de `deps`), avec
 * rechargement manuel possible. Pensé pour un backend qui n'est pas toujours
 * joignable depuis cet environnement de développement : l'erreur réseau est
 * capturée proprement plutôt que de faire planter la page. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const idAppelRef = useRef(0);

  const recharger = useCallback(() => {
    // Une requête plus ancienne (ex. "tous les clients") peut résoudre APRÈS
    // une plus récente (ex. un client filtré, réponse plus légère) si les deps
    // changent vite — sans ce garde, elle écraserait le résultat à jour avec
    // des données périmées.
    const idAppel = ++idAppelRef.current;
    setChargement(true);
    setErreur(null);
    fetcherRef
      .current()
      .then((resultat) => {
        if (idAppel === idAppelRef.current) setDonnees(resultat);
      })
      .catch((e) => {
        if (idAppel === idAppelRef.current) setErreur(messageErreur(e));
      })
      .finally(() => {
        if (idAppel === idAppelRef.current) setChargement(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    recharger();
  }, [recharger]);

  return { donnees, chargement, erreur, recharger };
}

/** Encapsule une action ponctuelle (créer / valider / supprimer...) avec son
 * propre état de soumission, pour désactiver le bouton et afficher l'erreur
 * du formulaire sans toucher au reste de la page. */
export function useAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const executer = useCallback(
    async (...args: A) => {
      setEnCours(true);
      setErreur(null);
      try {
        return await action(...args);
      } catch (e) {
        setErreur(messageErreur(e));
        throw e;
      } finally {
        setEnCours(false);
      }
    },
    [action],
  );

  return { executer, enCours, erreur, effacerErreur: () => setErreur(null) };
}
