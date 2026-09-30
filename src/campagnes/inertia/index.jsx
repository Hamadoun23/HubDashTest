/**
 * Remplaçant de `@inertiajs/react` pour les pages de Campagnes servies par
 * GDA Hub (alias Vite `@inertiajs/react` → ce fichier). Même API que celle
 * qu'utilisent les pages de BDM : `Head`, `Link`, `router`, `useForm`,
 * `usePage`. Le transport est dans `noyau.js`, l'affichage dans `HoteCampagnes`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cheminHub, cheminService, requeteInertia, urlService } from './noyau';

export const ContextePage = createContext(null);

/** Page Inertia courante : `{ component, props, url }`. */
export function usePage() {
    return useContext(ContextePage);
}

// L'hôte (HoteCampagnes) s'enregistre ici pour recevoir les pages visitées.
const hote = { afficher: null, charger: null, commencer: () => undefined, pageCourante: null };

export function enregistrerHote(h) {
    Object.assign(hote, h);
    return () => {
        hote.afficher = null;
        hote.charger = null;
        hote.commencer = () => undefined;
    };
}

function sortir(url) {
    window.location.href = urlService(url);
}

/**
 * Visite Inertia. GET : navigation du hub (l'hôte charge la page). Autres
 * méthodes : requête, puis affichage de la page d'arrivée (après redirection).
 */
async function visit(url, options = {}) {
    const {
        method = 'get',
        data,
        preserveState,
        preserveScroll = false,
        replace = false,
        forceFormData = false,
        onBefore,
        onStart,
        onSuccess,
        onError,
        onFinish,
    } = options;

    if (onBefore && onBefore() === false) return;
    const methode = method.toLowerCase();

    if (methode === 'get') {
        onStart?.();
        try {
            const page = await hote.charger(url, data, { preserveState: preserveState ?? false, preserveScroll, replace });
            if (page) {
                const erreurs = page.props?.errors ?? {};
                if (Object.keys(erreurs).length) onError?.(erreurs);
                else onSuccess?.(page);
            }
        } finally {
            onFinish?.();
        }
        return;
    }

    onStart?.();
    const visite = hote.commencer();
    try {
        const resultat = await requeteInertia(url, { method: methode, data, forceFormData });
        if (resultat.horsService) {
            // L'écriture a eu lieu mais la redirection n'a pas de page à
            // montrer : on recharge l'écran courant (messages et erreurs
            // déposés en session y apparaissent).
            const page = await hote.charger(hote.pageCourante?.url ?? '/dashboard', undefined, { preserveState: true, preserveScroll: true });
            const erreurs = page?.props?.errors ?? {};
            if (Object.keys(erreurs).length) onError?.(erreurs);
            else if (page) onSuccess?.(page);
            return;
        }
        if (resultat.externe) {
            sortir(resultat.externe);
            return;
        }
        const page = resultat.page;
        const erreurs = page.props?.errors ?? {};
        const aDesErreurs = Object.keys(erreurs).length > 0;
        // Après une écriture, la page d'arrivée est le plus souvent celle d'où
        // l'on vient (redirection « back ») : on garde alors l'état local des
        // composants (formulaire saisi, onglet ouvert), comme Inertia.
        const memeComposant = hote.pageCourante?.component === page.component;
        hote.afficher(page, {
            preserveState: preserveState ?? (aDesErreurs || memeComposant),
            preserveScroll: preserveScroll || aDesErreurs || memeComposant,
            replace,
            visite,
        });
        if (aDesErreurs) onError?.(erreurs);
        else onSuccess?.(page);
    } catch (e) {
        hote.afficher?.(null, { erreur: e, visite });
        onError?.({});
    } finally {
        onFinish?.();
    }
}

export const router = {
    visit,
    get: (url, data, options = {}) => visit(url, { ...options, method: 'get', data }),
    post: (url, data, options = {}) => visit(url, { ...options, method: 'post', data }),
    put: (url, data, options = {}) => visit(url, { ...options, method: 'put', data }),
    patch: (url, data, options = {}) => visit(url, { ...options, method: 'patch', data }),
    delete: (url, options = {}) => visit(url, { ...options, method: 'delete' }),
    reload: (options = {}) =>
        visit(hote.pageCourante?.url ?? '/dashboard', { preserveState: true, preserveScroll: true, ...options, method: 'get' }),
};

/** Formulaire Inertia : données, erreurs, envoi. */
export function useForm(...args) {
    // useForm(data) ou useForm(cleDeMemorisation, data) — la clé est ignorée.
    const initial = typeof args[0] === 'string' ? args[1] : args[0];
    const defauts = useRef(typeof initial === 'function' ? initial() : initial ?? {});
    const [data, setDataEtat] = useState(defauts.current);
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [wasSuccessful, setWasSuccessful] = useState(false);
    const [recentlySuccessful, setRecentlySuccessful] = useState(false);
    const transformation = useRef((d) => d);
    const minuterie = useRef(null);
    const dataRef = useRef(data);
    dataRef.current = data;

    useEffect(() => () => clearTimeout(minuterie.current), []);

    const setData = useCallback((cle, valeur) => {
        if (typeof cle === 'string') setDataEtat((d) => ({ ...d, [cle]: valeur }));
        else if (typeof cle === 'function') setDataEtat((d) => cle(d));
        else setDataEtat(cle);
    }, []);

    const submit = useCallback((method, url, options = {}) => {
        const donnees = transformation.current(dataRef.current);
        setProcessing(true);
        setWasSuccessful(false);
        return visit(url, {
            ...options,
            method,
            data: donnees,
            onSuccess: (page) => {
                setErrors({});
                setWasSuccessful(true);
                setRecentlySuccessful(true);
                clearTimeout(minuterie.current);
                minuterie.current = setTimeout(() => setRecentlySuccessful(false), 2000);
                options.onSuccess?.(page);
            },
            onError: (erreurs) => {
                setErrors(erreurs);
                options.onError?.(erreurs);
            },
            onFinish: () => {
                setProcessing(false);
                options.onFinish?.();
            },
        });
    }, []);

    const reset = useCallback((...champs) => {
        if (champs.length === 0) setDataEtat(defauts.current);
        else
            setDataEtat((d) => {
                const suite = { ...d };
                champs.forEach((c) => {
                    suite[c] = defauts.current[c];
                });
                return suite;
            });
    }, []);

    const clearErrors = useCallback((...champs) => {
        if (champs.length === 0) setErrors({});
        else
            setErrors((e) => {
                const suite = { ...e };
                champs.forEach((c) => delete suite[c]);
                return suite;
            });
    }, []);

    const setError = useCallback((cle, message) => {
        if (typeof cle === 'string') setErrors((e) => ({ ...e, [cle]: message }));
        else setErrors((e) => ({ ...e, ...cle }));
    }, []);

    return {
        data,
        setData,
        errors,
        hasErrors: Object.keys(errors).length > 0,
        processing,
        progress: null,
        wasSuccessful,
        recentlySuccessful,
        isDirty: JSON.stringify(data) !== JSON.stringify(defauts.current),
        transform: (fn) => {
            transformation.current = fn;
        },
        setDefaults: (cle, valeur) => {
            if (cle === undefined) defauts.current = dataRef.current;
            else if (typeof cle === 'string') defauts.current = { ...defauts.current, [cle]: valeur };
            else defauts.current = { ...defauts.current, ...cle };
        },
        reset,
        clearErrors,
        setError,
        submit,
        get: (url, options) => submit('get', url, options),
        post: (url, options) => submit('post', url, options),
        put: (url, options) => submit('put', url, options),
        patch: (url, options) => submit('patch', url, options),
        delete: (url, options) => submit('delete', url, options),
        cancel: () => {},
    };
}

/**
 * Lien Inertia. Une adresse du service devient une route du hub (clic
 * intercepté, clic du milieu et « ouvrir dans un onglet » fonctionnent grâce
 * au `#/...`). Un lien avec `target` (exports, pièces jointes) reste un vrai
 * lien vers le service.
 */
export function Link({
    href,
    method = 'get',
    data,
    as,
    preserveScroll,
    preserveState,
    replace,
    only,
    headers,
    onClick,
    target,
    children,
    ...props
}) {
    const hub = cheminHub(href);
    const methode = method.toLowerCase();

    if (target || hub === null || href === '#') {
        const lien = hub === null || href === '#' ? href : urlService(href);
        return (
            <a href={lien} target={target} onClick={onClick} {...props}>
                {children}
            </a>
        );
    }

    function clic(e) {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (methode === 'get' && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
        e.preventDefault();
        visit(href, { method: methode, data, preserveScroll, preserveState, replace });
    }

    const Balise = as && as !== 'a' ? as : 'a';
    const attributs = Balise === 'a' ? { href: `#${hub}` } : { type: 'button' };
    return (
        <Balise {...attributs} onClick={clic} {...props}>
            {children}
        </Balise>
    );
}

/** `<Head title="…" />` : titre de l'onglet. */
export function Head({ title, children }) {
    const titre = useMemo(() => {
        if (title) return title;
        let trouve = null;
        const parcourir = (n) => {
            if (!n || trouve) return;
            if (Array.isArray(n)) n.forEach(parcourir);
            else if (n.type === 'title') trouve = [].concat(n.props.children).join('');
        };
        parcourir(children);
        return trouve;
    }, [title, children]);

    useEffect(() => {
        if (titre) document.title = `${titre} — Campagnes GDA`;
    }, [titre]);
    return null;
}

export { cheminService };
