import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { Utilisateur } from '../api/auth';
import * as identityApi from '../api/identity';
import type { Application, IdentiteUtilisateur } from '../api/identity';
import { lireJetonsStockes } from '../api/client';

const CLE_APPLICATIONS = 'gdahub_applications';

type ApplicationsStockees = { identite: IdentiteUtilisateur; habilitations: Record<string, string[]>; applications: Application[] };

function lireApplicationsStockees(): ApplicationsStockees | null {
  try {
    const brut = localStorage.getItem(CLE_APPLICATIONS);
    return brut ? (JSON.parse(brut) as ApplicationsStockees) : null;
  } catch {
    return null;
  }
}

function ecrireApplicationsStockees(donnees: ApplicationsStockees | null) {
  try {
    if (donnees) localStorage.setItem(CLE_APPLICATIONS, JSON.stringify(donnees));
    else localStorage.removeItem(CLE_APPLICATIONS);
  } catch {
    // Stockage indisponible : le lanceur d'applications sera simplement vide pour cette session.
  }
}

type EtatAuth = {
  /** Profil RH/Finance enrichi (poste, département, solde...) — utilisé par les écrans RH. */
  utilisateur: Utilisateur | null;
  /** Identité du hub (nom, email, photo) — toujours disponible dès la connexion, même si le profil métier échoue. */
  identite: IdentiteUtilisateur | null;
  /** Applications auxquelles l'utilisateur a accès (lanceur du hub). */
  applications: Application[];
  habilitations: Record<string, string[]>;
  chargement: boolean;
  connecter: (identifiant: string, motDePasse: string) => Promise<void>;
  deconnecter: () => void;
  rafraichirProfil: () => Promise<void>;
  definirIdentite: (identite: IdentiteUtilisateur) => void;
};

const AuthContext = createContext<EtatAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [identite, setIdentite] = useState<IdentiteUtilisateur | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [habilitations, setHabilitations] = useState<Record<string, string[]>>({});
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!lireJetonsStockes()) {
      setChargement(false);
      return;
    }
    const stocke = lireApplicationsStockees();
    if (stocke) {
      setIdentite(stocke.identite);
      setApplications(stocke.applications);
      setHabilitations(stocke.habilitations);
    }
    // Le profil RH enrichi n'est pas persisté (peut changer côté serveur) : on le recharge à chaque montage.
    authApi
      .obtenirProfil()
      .then(setUtilisateur)
      .catch(() => setUtilisateur(null))
      .finally(() => setChargement(false));
  }, []);

  const connecter = useCallback(async (identifiant: string, motDePasse: string) => {
    const reponse = await identityApi.connexionIdentity(identifiant, motDePasse);
    setIdentite(reponse.utilisateur);
    setApplications(reponse.applications);
    setHabilitations(reponse.habilitations);
    ecrireApplicationsStockees({ identite: reponse.utilisateur, habilitations: reponse.habilitations, applications: reponse.applications });

    // Le profil RH enrichi (poste, département...) vit sur financerh — accessible via le pont JWKS
    // avec le même jeton. S'il échoue (agent non rattaché à financerh), la connexion au hub reste valide.
    try {
      setUtilisateur(await authApi.obtenirProfil());
    } catch {
      setUtilisateur(null);
    }
  }, []);

  const deconnecter = useCallback(() => {
    authApi.deconnexion();
    ecrireApplicationsStockees(null);
    setUtilisateur(null);
    setIdentite(null);
    setApplications([]);
    setHabilitations({});
  }, []);

  const rafraichirProfil = useCallback(async () => {
    const profil = await authApi.obtenirProfil();
    setUtilisateur(profil);
  }, []);

  // Utilisé après un changement de photo par exemple : met à jour l'état ET le cache local,
  // sans reproduire le mécanisme complet de connexion.
  const definirIdentite = useCallback((nouvelleIdentite: IdentiteUtilisateur) => {
    setIdentite(nouvelleIdentite);
    const stocke = lireApplicationsStockees();
    if (stocke) ecrireApplicationsStockees({ ...stocke, identite: nouvelleIdentite });
  }, []);

  return (
    <AuthContext.Provider
      value={{ utilisateur, identite, applications, habilitations, chargement, connecter, deconnecter, rafraichirProfil, definirIdentite }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous <AuthProvider>');
  return ctx;
}
