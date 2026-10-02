import { useEffect } from 'react';

/**
 * Sur téléphone, index.css transforme chaque ligne de tableau en carte :
 * chaque cellule affiche alors son titre de colonne au-dessus de sa valeur.
 * Ce composant, monté une fois, recopie ces titres (texte du <th>, ou son
 * `data-label` s'il en a un) dans l'attribut `data-label` des cellules — et
 * suit les filtres, la pagination et les rechargements grâce à un
 * MutationObserver. Aucune page n'a à s'en occuper.
 */
function etiqueter(tableau: HTMLTableElement) {
  const entetes = Array.from(tableau.querySelectorAll('thead th')).map(
    (th) => (th.getAttribute('data-label') ?? th.textContent ?? '').trim(),
  );
  if (entetes.length === 0) return;
  tableau.querySelectorAll('tbody tr').forEach((ligne) => {
    Array.from(ligne.children).forEach((cellule, i) => {
      const libelle = entetes[i] ?? '';
      if (cellule.getAttribute('data-label') !== libelle) cellule.setAttribute('data-label', libelle);
    });
  });
}

export function LibellesTableaux() {
  useEffect(() => {
    let prevu = 0;
    const tout = () => {
      prevu = 0;
      document.querySelectorAll('table').forEach((t) => etiqueter(t as HTMLTableElement));
    };
    const planifier = () => {
      if (!prevu) prevu = window.requestAnimationFrame(tout);
    };
    tout();
    const observateur = new MutationObserver(planifier);
    observateur.observe(document.body, { childList: true, subtree: true });
    return () => {
      observateur.disconnect();
      if (prevu) window.cancelAnimationFrame(prevu);
    };
  }, []);
  return null;
}
