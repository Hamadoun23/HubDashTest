import { useSyncExternalStore } from 'react';
import { apiFetch, lireJetonsStockes } from './api/client';

/**
 * Photos de profil des collègues, pour tous les avatars de l'interface.
 *
 * Chargées une fois (puis toutes les 10 minutes) depuis identity, et
 * retrouvées par adresse e-mail, identifiant ou nom complet. Une photo
 * changée sur un appareil apparaît ainsi sur les autres et chez les
 * collègues, sans dépendre de ce qui est mémorisé dans le navigateur.
 */
type PhotoCollegue = { identifiant: string; email: string; nom_complet: string; photo: string };
type Annuaire = Map<string, string>;

const DUREE_MS = 10 * 60 * 1000;
let annuaire: Annuaire = new Map();
let chargeLe = 0;
let enCours: Promise<void> | null = null;
const abonnes = new Set<() => void>();

export const cleNom = (valeur: string) =>
  valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function charger(forcer = false) {
  if (enCours || !lireJetonsStockes()) return;
  if (!forcer && Date.now() - chargeLe < DUREE_MS) return;
  enCours = apiFetch<PhotoCollegue[]>('/identity/auth/photos')
    .then((liste) => {
      const suivant: Annuaire = new Map();
      for (const p of liste) {
        if (p.email) suivant.set(p.email.toLowerCase(), p.photo);
        if (p.identifiant) suivant.set(p.identifiant.toLowerCase(), p.photo);
        if (p.nom_complet) suivant.set(cleNom(p.nom_complet), p.photo);
      }
      annuaire = suivant;
      chargeLe = Date.now();
      abonnes.forEach((f) => f());
    })
    .catch(() => undefined)
    .finally(() => {
      enCours = null;
    });
}

/** À appeler après un changement de sa propre photo. */
export function rafraichirPhotos() {
  charger(true);
}

function sAbonner(f: () => void) {
  abonnes.add(f);
  charger();
  return () => abonnes.delete(f);
}

/** Photo d'une personne, par e-mail ou par nom ; `undefined` si aucune. */
export function usePhoto(email?: string | null, nom?: string | null): string | undefined {
  const carte = useSyncExternalStore(sAbonner, () => annuaire);
  return (email && carte.get(email.toLowerCase())) || (nom ? carte.get(cleNom(nom)) : undefined) || undefined;
}
