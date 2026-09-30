/**
 * Hôte des pages de Campagnes dans GDA Hub (route `#/campagnes/*`).
 *
 * Reprend le rôle de `createInertiaApp` dans BDM : il demande au service la
 * page qui correspond à l'adresse (`#/campagnes/ventes` → `/campagnes/ventes`
 * en Inertia/JSON), résout le composant par son nom (`Ventes/Index` →
 * `./Pages/Ventes/Index.jsx`) et l'affiche avec ses props. Les pages et
 * composants sont ceux de BDM, repris sans réécriture.
 */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './campagnes.css';
import { Chart } from 'chart.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as LienHub, useLocation, useNavigate } from 'react-router-dom';
import { ContextePage, enregistrerHote } from './inertia';
import { useCommercialExterne } from '../lib/auth/commercialExterne';
import { chargerZiggy, cheminHub, cheminService, definirEmplacement, PREFIXE_HUB, requeteInertia, urlAvecDonnees, urlService } from './inertia/noyau';

const pages = import.meta.glob('./Pages/**/*.jsx');
const composants = new Map();

async function resoudre(nom) {
    if (composants.has(nom)) return composants.get(nom);
    const chargeur = pages[`./Pages/${nom}.jsx`];
    if (!chargeur) return null;
    const module = await chargeur();
    composants.set(nom, module.default);
    return module.default;
}

/** Chemin du service pour l'adresse du hub courante. */
function serviceDepuisHub(location) {
    const reste = location.pathname.slice(PREFIXE_HUB.length) || '/';
    return reste + location.search;
}

function Message({ titre, texte, action }) {
    const externe = useCommercialExterne();
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F5F2] px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-card ring-1 ring-gray-200">
                <img src="/campagnes/logo/gdamoney-mark.png" alt="" className="mx-auto mb-4 h-10 w-auto object-contain" />
                <h1 className="text-lg font-semibold text-gray-900">{titre}</h1>
                <p className="mt-2 text-sm text-gray-500">{texte}</p>
                <div className="mt-6 flex justify-center gap-2">
                    {action}
                    {!externe && <LienHub
                        to="/"
                        className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        ← GDA Hub
                    </LienHub>}
                </div>
            </div>
        </div>
    );
}

export default function HoteCampagnes() {
    const location = useLocation();
    const navigate = useNavigate();
    const [page, setPage] = useState(null);
    const [Composant, setComposant] = useState(null);
    const [cle, setCle] = useState(0);
    const [erreur, setErreur] = useState(null);
    const [chargements, setChargements] = useState(0);
    const [pret, setPret] = useState(false);
    const dejaAffiche = useRef(null);
    const pageRef = useRef(null);
    // Numéro de la dernière visite lancée. La réponse d'une visite dépassée
    // (l'utilisateur a déjà cliqué ailleurs) est ignorée, comme dans Inertia :
    // sinon elle ramènerait l'écran en arrière et les deux visites se
    // renverraient la balle.
    const visiteCourante = useRef(0);
    const commencer = useCallback(() => ++visiteCourante.current, []);

    const afficher = useCallback(
        async (nouvelle, { preserveState = false, preserveScroll = false, replace = false, erreur: e, visite } = {}) => {
            const perimee = () => visite !== undefined && visite !== visiteCourante.current;
            if (perimee()) return;
            if (e) {
                setErreur(e);
                return;
            }
            const C = await resoudre(nouvelle.component);
            if (perimee()) return;
            if (!C) {
                setErreur({ inconnu: nouvelle.component });
                return;
            }
            setErreur(null);
            definirEmplacement(nouvelle.url);
            pageRef.current = nouvelle;
            enregistrerHote({ pageCourante: nouvelle });
            if (!preserveState) setCle((k) => k + 1);
            setComposant(() => C);
            setPage(nouvelle);

            const cible = cheminHub(nouvelle.url);
            // Lue dans la barre d'adresse et non dans `location` : cette
            // fonction peut s'exécuter après une requête lancée depuis un
            // rendu antérieur, dont `location` est périmé.
            const actuelle = window.location.hash.slice(1) || '/';
            if (cible && cible !== actuelle) {
                dejaAffiche.current = cible;
                navigate(cible, { replace });
            }
            if (!preserveScroll) {
                // La zone de contenu défile seule (cf. AppLayout), la fenêtre non.
                document.querySelector('[data-defilement]')?.scrollTo(0, 0);
                window.scrollTo(0, 0);
            }
        },
        [navigate],
    );

    const charger = useCallback(
        async (url, data, options = {}) => {
            const visite = commencer();
            setChargements((n) => n + 1);
            try {
                const resultat = await requeteInertia(urlAvecDonnees(url, data));
                if (visite !== visiteCourante.current) return null;
                if (resultat.externe) {
                    window.location.href = urlService(resultat.externe);
                    return null;
                }
                await afficher(resultat.page, { ...options, visite });
                return resultat.page;
            } catch (e) {
                if (visite === visiteCourante.current) setErreur(e);
                return null;
            } finally {
                setChargements((n) => n - 1);
            }
        },
        [afficher, commencer],
    );

    useEffect(
        () => enregistrerHote({ afficher, charger, commencer, pageCourante: pageRef.current }),
        [afficher, charger, commencer],
    );

    // Graphiques lisibles sur fond sombre (thème du hub), le temps que l'on
    // reste dans Campagnes : les autres applications gardent leurs réglages.
    useEffect(() => {
        // L'élément « arc » n'existe qu'une fois enregistré par une page à
        // graphique circulaire : il peut manquer à l'ouverture de Campagnes.
        const arc = Chart.defaults.elements?.arc;
        const avant = { color: Chart.defaults.color, borderColor: Chart.defaults.borderColor, arc: arc?.borderColor };
        Chart.defaults.color = '#c9b8ab';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
        if (arc) arc.borderColor = '#2a1d15';
        return () => {
            Chart.defaults.color = avant.color;
            Chart.defaults.borderColor = avant.borderColor;
            if (arc) arc.borderColor = avant.arc;
        };
    }, []);

    useEffect(() => {
        chargerZiggy()
            .then(() => setPret(true))
            .catch((e) => setErreur(e));
    }, []);

    // Toute arrivée sur une adresse que l'on n'a pas soi-même affichée
    // (lien du hub, précédent/suivant du navigateur, adresse tapée).
    useEffect(() => {
        if (!pret) return;
        const actuelle = location.pathname + location.search;
        if (dejaAffiche.current === actuelle) {
            dejaAffiche.current = null;
            return;
        }
        dejaAffiche.current = null;
        const chemin = serviceDepuisHub(location);
        charger(chemin === '/' ? '/dashboard' : chemin, undefined, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pret, location.pathname, location.search]);

    const barre = chargements > 0 && (
        <div className="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-orange-100">
            <div className="h-full w-1/3 animate-[bdm-chargement_1s_ease-in-out_infinite] bg-gda-orange" />
        </div>
    );

    let contenu;
    if (erreur?.inconnu?.startsWith('Auth/')) {
        contenu = (
            <Message
                titre="Accès à Campagnes non ouvert"
                texte="Votre compte n'est rattaché à aucun compte Campagnes. Demandez à un administrateur de vous donner l'accès."
            />
        );
    } else if (erreur?.inconnu) {
        contenu = <Message titre="Écran indisponible" texte={`L'écran « ${erreur.inconnu} » n'existe pas dans cette version.`} />;
    } else if (erreur && !page) {
        contenu = (
            <Message
                titre="Campagnes ne répond pas"
                texte={erreur.message || 'Le service est momentanément indisponible.'}
                action={
                    <button
                        type="button"
                        onClick={() => {
                            setErreur(null);
                            charger(serviceDepuisHub(location));
                        }}
                        className="inline-flex h-9 items-center rounded-lg bg-gda-orange px-4 text-sm font-medium text-white hover:bg-orange-600"
                    >
                        Réessayer
                    </button>
                }
            />
        );
    } else if (!page || !Composant) {
        contenu = (
            <div className="flex min-h-screen items-center justify-center bg-[#F6F5F2]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-gda-orange" />
            </div>
        );
    } else {
        contenu = (
            <ContextePage.Provider value={page}>
                {erreur && (
                    <div className="fixed inset-x-0 top-3 z-[90] mx-auto w-fit max-w-[90vw] rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 shadow">
                        {erreur.message}
                        <button type="button" className="ml-3 font-medium underline" onClick={() => setErreur(null)}>
                            Fermer
                        </button>
                    </div>
                )}
                <Composant key={cle} {...page.props} />
            </ContextePage.Provider>
        );
    }

    return (
        <div className="bdm-app">
            {barre}
            {contenu}
        </div>
    );
}

export { cheminService };
