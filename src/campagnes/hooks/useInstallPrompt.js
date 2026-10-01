import { useCallback, useEffect, useState } from 'react';

/**
 * Détecte la possibilité d'installer la PWA et expose le geste d'installation.
 *
 * Deux mondes bien distincts :
 * - Chrome/Edge/Android déclenchent `beforeinstallprompt` : on peut proposer
 *   l'installation en un clic via `prompt()`.
 * - Safari iOS ne déclenche jamais cet événement : la seule voie est le menu
 *   Partager > Sur l'écran d'accueil, qu'on ne peut que décrire à l'utilisateur.
 */
function estIOS() {
    const ua = window.navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
}

function estDejaInstallee() {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    // Propriété non standard exposée par Safari iOS en mode écran d'accueil.
    return Boolean(window.navigator.standalone);
}

export default function useInstallPrompt() {
    const [evenementNatif, setEvenementNatif] = useState(null);
    const [installee, setInstallee] = useState(estDejaInstallee);

    useEffect(() => {
        function onBeforeInstallPrompt(evenement) {
            // Empêche la mini-infobar automatique de Chrome : on affiche notre
            // propre bouton, déclenché au moment choisi par l'utilisateur.
            evenement.preventDefault();
            setEvenementNatif(evenement);
        }
        function onAppInstalled() {
            setEvenementNatif(null);
            setInstallee(true);
        }

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
        };
    }, []);

    const installer = useCallback(async () => {
        if (!evenementNatif) return null;
        evenementNatif.prompt();
        const { outcome } = await evenementNatif.userChoice;
        setEvenementNatif(null);
        return outcome; // 'accepted' | 'dismissed'
    }, [evenementNatif]);

    return {
        installee,
        peutInstallerNatif: Boolean(evenementNatif),
        iOS: estIOS(),
        installer,
    };
}
