import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Filet de sécurité : une erreur dans un écran affiche un message et un
 * bouton pour recharger, au lieu de laisser toute l'interface blanche.
 */
export class FiletErreur extends Component<{ children: ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null };

  static getDerivedStateFromError(erreur: Error) {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error('Erreur d’affichage', erreur, info.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    // Nouvelle version déployée : les anciens fichiers découpés n'existent plus.
    const versionPerimee = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(this.state.erreur.message);
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-white">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-7 text-center backdrop-blur-xl">
          <p className="font-display text-lg font-bold">{versionPerimee ? 'Nouvelle version disponible' : 'Un problème est survenu'}</p>
          <p className="mt-2 text-sm text-muted">
            {versionPerimee
              ? 'GDA Hub a été mis à jour. Rechargez pour continuer.'
              : 'Cet écran n’a pas pu s’afficher. Rechargez la page ; si le problème persiste, prévenez l’équipe technique.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-black hover:bg-accent2"
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
