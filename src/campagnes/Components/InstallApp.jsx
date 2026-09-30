import { useState } from 'react';
import { Download } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import useInstallPrompt from '@campagnes/hooks/useInstallPrompt';

//: Un seul indicateur pour le toast et le bouton d'en-tête : une fois la
//: notification traitée (installée, refusée, ou instructions déjà vues), le
//: bouton d'en-tête reste l'unique voie pour installer plus tard.
const CLE_NOTIF_MASQUEE = 'bdm_install_notif_masquee';

function InstructionsInstallation({ open, onClose, iOS }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Installer l'application"
            description="Un raccourci direct depuis l'écran d'accueil, sans passer par le navigateur."
        >
            {iOS ? (
                <ol className="list-decimal space-y-2 pl-4 text-sm text-gray-700">
                    <li>
                        Appuyez sur l'icône de <strong>partage</strong> (le carré avec une flèche vers le
                        haut) en bas de l'écran Safari.
                    </li>
                    <li>
                        Faites défiler le menu et choisissez <strong>« Sur l'écran d'accueil »</strong>.
                    </li>
                    <li>
                        Appuyez sur <strong>« Ajouter »</strong> en haut à droite.
                    </li>
                </ol>
            ) : (
                <ol className="list-decimal space-y-2 pl-4 text-sm text-gray-700">
                    <li>Ouvrez le menu du navigateur (les trois points, en haut à droite).</li>
                    <li>
                        Choisissez <strong>« Installer l'application »</strong> (ou{' '}
                        <strong>« Ajouter à l'écran d'accueil »</strong>).
                    </li>
                    <li>Confirmez l'installation.</li>
                </ol>
            )}
        </Modal>
    );
}

function masquerNotif() {
    try {
        localStorage.setItem(CLE_NOTIF_MASQUEE, '1');
    } catch {
        // Stockage indisponible (navigation privée...) : la notification
        // réapparaîtra à la prochaine visite, sans conséquence grave.
    }
}

/**
 * Bouton compact pour l'en-tête : toujours accessible, discret, disparaît une
 * fois l'application installée. Sur un navigateur sans voie d'installation
 * fiable (Firefox desktop, par ex.), il n'y a rien de vrai à proposer.
 *
 * C'est le seul moyen d'installer une fois que la notification (ci-dessous) a
 * été traitée — elle ne revient pas nager l'utilisateur à chaque visite.
 */
export function InstallAppButton() {
    const { installee, peutInstallerNatif, iOS, installer } = useInstallPrompt();
    const [showInstructions, setShowInstructions] = useState(false);

    if (installee || (!peutInstallerNatif && !iOS)) return null;

    async function onClick() {
        if (peutInstallerNatif) {
            await installer();
            return;
        }
        setShowInstructions(true);
    }

    return (
        <>
            <button
                onClick={onClick}
                title="Installer l'application"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm ring-1 ring-gray-200 hover:text-gda-orange"
            >
                <Download size={16} />
            </button>
            <InstructionsInstallation open={showInstructions} onClose={() => setShowInstructions(false)} iOS={iOS} />
        </>
    );
}

/**
 * Notification flottante (façon pop-up mobile), posée sur l'écran de
 * connexion et sur les pages une fois connecté. Vue une seule fois par
 * appareil : « Installer » lance le geste natif (ou les instructions iOS),
 * « Non merci » la masque définitivement — pour l'utilisateur qui a déjà
 * l'application installée ou ne la veut pas.
 */
export function InstallAppToast() {
    const { installee, peutInstallerNatif, iOS, installer } = useInstallPrompt();
    const [showInstructions, setShowInstructions] = useState(false);
    const [masquee, setMasquee] = useState(() => {
        try {
            return localStorage.getItem(CLE_NOTIF_MASQUEE) === '1';
        } catch {
            return false;
        }
    });

    if (installee || masquee || (!peutInstallerNatif && !iOS)) return null;

    function nonMerci() {
        setMasquee(true);
        masquerNotif();
    }

    async function installerMaintenant() {
        if (peutInstallerNatif) {
            await installer();
        } else {
            setShowInstructions(true);
        }
        // Vue et traitée : le bouton d'en-tête reste disponible si besoin.
        setMasquee(true);
        masquerNotif();
    }

    return (
        <>
            <div
                className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-sm items-start gap-3 rounded-2xl bg-white p-4 shadow-[0_10px_40px_-10px_rgba(56,20,25,0.35)] ring-1 ring-gray-200 sm:inset-x-auto sm:right-6 sm:bottom-6"
                style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                role="dialog"
                aria-label="Installer l'application"
            >
                <img src="/campagnes/logo/iconesgda.png" alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">Installer l'application ?</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                        Ajoutez-la à votre écran d'accueil pour un accès plus rapide, sans passer par le
                        navigateur.
                    </p>
                    <div className="mt-3 flex gap-2">
                        <Button onClick={installerMaintenant} size="sm">Installer</Button>
                        <Button onClick={nonMerci} variant="ghost" size="sm">Non merci</Button>
                    </div>
                </div>
            </div>
            <InstructionsInstallation open={showInstructions} onClose={() => setShowInstructions(false)} iOS={iOS} />
        </>
    );
}
