import { GrainGradient } from '@paper-design/shaders-react';
import { memo, useEffect, useState } from 'react';

/**
 * Les couleurs du degrade — hors du composant, et ce n'est pas un detail.
 *
 * Ecrit dans le JSX, ce tableau etait recree a chaque rendu. Le shader y
 * voyait une nouvelle valeur et rechargeait ses uniformes, image comprise. Or
 * le formulaire se rend a chaque frappe : saisir son mot de passe redessinait
 * le decor lettre par lettre. Une seule frappe coutait plusieurs secondes.
 */
const COULEURS = ['#FFFFFF', '#FF6A3A', '#b26440', '#381419'];

/** Le degrade fige, en CSS : aucun canevas, aucune boucle d'animation. */
const DEGRADE_FIXE =
    'radial-gradient(120% 90% at 12% 8%, #FFFFFF 0%, #FF6A3A 38%, #b26440 68%, #381419 100%)';

/**
 * Le système demande-t-il qu'on limite les animations ?
 *
 * Le dégradé de cet écran tourne en continu, image après image. C'est joli sur
 * un poste de bureau ; sur le téléphone d'un commercial en tournée, c'est du
 * processeur et de la batterie dépensés pour un décor, et pour les personnes
 * sensibles au mouvement c'est un écran qu'on ne peut pas regarder. Le
 * navigateur porte déjà la réponse : `prefers-reduced-motion`.
 *
 * La valeur est lue après le premier rendu, et non pendant : `matchMedia`
 * n'existe pas côté serveur, et l'appeler au rendu ferait diverger le HTML
 * envoyé et celui recalculé dans le navigateur.
 */
function mouvementReduit() {
    const [reduit, setReduit] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const requete = window.matchMedia('(prefers-reduced-motion: reduce)');
        const suivre = () => setReduit(requete.matches);
        suivre();
        requete.addEventListener('change', suivre);
        return () => requete.removeEventListener('change', suivre);
    }, []);

    return reduit;
}

/**
 * Le décor, isolé du formulaire.
 *
 * `memo` fait ici tout le travail : le composant ne reçoit qu'un booléen, donc
 * une frappe dans le champ voisin ne le rend plus du tout. Sans cette
 * séparation, chaque lettre saisie repassait par le shader.
 *
 * Sous mouvement réduit, on ne fige pas l'animation — on retire le canevas.
 * Une boucle qui redessine la même image trente-sept fois par seconde coûte
 * exactement aussi cher qu'une qui en dessine trente-sept différentes, et sur
 * le téléphone d'un commercial en tournée, c'est de la batterie.
 */
const Decor = memo(function Decor({ reduit }) {
    if (reduit) {
        return (
            <div
                aria-hidden
                className="absolute inset-0"
                style={{ backgroundImage: DEGRADE_FIXE }}
            />
        );
    }

    return (
        <GrainGradient
            speed={0.35}
            scale={1}
            rotation={0}
            offsetX={0}
            offsetY={0}
            softness={0.75}
            intensity={0.45}
            noise={0.12}
            shape="corners"
            colors={COULEURS}
            colorBack="#FFFFFF"
            className="absolute inset-0"
        />
    );
});

/**
 * Coquille commune aux écrans d'authentification : dégradé plein écran
 * (palette GDA uniquement — blanc, orange, cuivre, brun ; pas de noir) et carte
 * formulaire posée dessus, à droite.
 */
export default function AuthCard({ title, subtitle, children }) {
    const reduit = mouvementReduit();

    return (
        <div className="relative min-h-screen overflow-hidden bg-white">
            <Decor reduit={reduit} />

            {/* Voile brun GDA sur la moitié gauche : le dégradé étant animé, le texte blanc
                pouvait tomber sur une zone claire et devenir illisible. Teinte de marque
                (#381419), pas du noir. */}
            <div
                className="pointer-events-none absolute inset-y-0 left-0 hidden w-[62%] lg:block"
                style={{
                    background:
                        'linear-gradient(to right, rgba(56,20,25,0.78) 0%, rgba(56,20,25,0.55) 45%, rgba(56,20,25,0) 100%)',
                }}
            />

            <div
                className="relative grid min-h-screen gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:items-center lg:gap-12 lg:px-14 xl:px-20"
                style={{
                    paddingTop: 'calc(env(safe-area-inset-top) + 2.5rem)',
                    paddingBottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)',
                }}
            >
                {/* Colonne marque — masquée sur mobile, l'espace revient au formulaire. */}
                <div className="hidden min-w-0 lg:flex lg:flex-col lg:justify-center">
                    <img
                        src="/img/logo-gda-carre.png"
                        alt="GDA"
                        className="h-14 w-auto self-start rounded-xl bg-white px-4 py-2.5 object-contain shadow-sm"
                    />

                    <h2 className="mt-10 max-w-xl text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] text-white xl:text-[52px]">
                        Pilotez vos campagnes
                        <br />
                        en temps réel.
                    </h2>
                    <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/80">
                        Ventes terrain, reporting téléphonique, performances et contrats — tout le suivi
                        commercial du Groupe GDA dans un seul espace.
                    </p>
                </div>

                {/* Carte formulaire — posée sur le dégradé. */}
                <div className="flex min-w-0 items-center justify-center lg:justify-end">
                    <div className="w-full max-w-[420px] rounded-2xl bg-white p-7 shadow-[0_20px_60px_-15px_rgba(56,20,25,0.35)] sm:p-9">
                        <img
                            src="/img/logo-gda-carre.png"
                            alt="GDA"
                            className="mb-7 h-10 w-auto object-contain lg:hidden"
                        />

                        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-ardoise-900 sm:text-[30px]">
                            {title}
                        </h1>
                        {subtitle && <p className="mt-2 text-[15px] text-ardoise-500">{subtitle}</p>}

                        <div className="mt-7">{children}</div>

                        <p className="mt-7 border-t border-ardoise-100 pt-4 text-xs text-ardoise-400">
                            © {new Date().getFullYear()} Groupe GDA
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
