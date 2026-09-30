import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type InviteInstallation = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

function estInstallee() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function estIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

/**
 * « Installer l'application » : sur Android et ordinateur, l'invite native
 * du navigateur ; sur iPhone (qui n'en a pas), la marche à suivre. Rien une
 * fois l'application installée.
 */
export function BoutonInstaller() {
  const [invite, setInvite] = useState<InviteInstallation | null>(null);
  const [installee, setInstallee] = useState(estInstallee);
  const [aideIos, setAideIos] = useState(false);

  useEffect(() => {
    const surInvite = (e: Event) => {
      e.preventDefault();
      setInvite(e as InviteInstallation);
    };
    const surInstallation = () => {
      setInstallee(true);
      setInvite(null);
    };
    window.addEventListener('beforeinstallprompt', surInvite);
    window.addEventListener('appinstalled', surInstallation);
    return () => {
      window.removeEventListener('beforeinstallprompt', surInvite);
      window.removeEventListener('appinstalled', surInstallation);
    };
  }, []);

  if (installee || (!invite && !estIos())) return null;

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (invite) {
            await invite.prompt();
            await invite.userChoice;
            setInvite(null);
          } else {
            setAideIos(true);
          }
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-accent2 transition-colors hover:bg-surface2 hover:text-white"
      >
        <Download size={17} />
        Installer l'application
      </button>

      {aideIos && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setAideIos(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-border bg-[#1a130e] p-5 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <p className="font-display text-lg font-bold">Installer GDA Hub</p>
              <button type="button" onClick={() => setAideIos(false)} aria-label="Fermer" className="text-muted hover:text-white">
                <X size={18} />
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-muted">
              <li className="flex items-center gap-2">
                1. Touchez <Share size={15} className="text-white" /> <span className="text-white">Partager</span> dans Safari
              </li>
              <li>
                2. Choisissez <span className="text-white">« Sur l'écran d'accueil »</span>
              </li>
              <li>3. Ouvrez GDA Hub depuis l'icône : il s'affiche en plein écran et reçoit les notifications.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
