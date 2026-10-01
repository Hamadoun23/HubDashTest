import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  abonnerPush,
  clePush,
  desabonnerPush,
  listerNotifications,
  marquerNotificationLue,
  toutMarquerLu,
  type NotificationHub,
} from '../api/notifications';

/**
 * Notifications de la personne connectée, partagées par toute l'interface
 * (cloche de la barre du haut, entrée de la barre latérale, page dédiée).
 *
 * - Lecture : toutes les minutes, et dès que l'onglet redevient visible.
 * - Push : sur un appareil abonné (application installée ou navigateur), le
 *   service worker affiche la notification même l'interface fermée.
 */
type Etat = {
  notifications: NotificationHub[];
  nonLues: number;
  recharger: () => void;
  marquerLue: (id: number) => void;
  toutLire: () => void;
  push: EtatPush;
  activerPush: () => Promise<void>;
  desactiverPush: () => Promise<void>;
};

/** `indisponible` : navigateur sans Web Push (ou page non sécurisée). */
export type EtatPush = 'indisponible' | 'refuse' | 'inactif' | 'actif';

const Contexte = createContext<Etat | null>(null);
const PERIODE_MS = 60_000;

function pushDisponible() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
}

function versUint8(base64: string) {
  const complet = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(complet);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationHub[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [push, setPush] = useState<EtatPush>('indisponible');
  const enCours = useRef(false);

  const recharger = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      const donnees = await listerNotifications();
      setNotifications(donnees.resultats);
      setNonLues(donnees.non_lues);
    } catch {
      // Hors ligne ou session expirée : on réessaiera au prochain tour.
    } finally {
      enCours.current = false;
    }
  }, []);

  useEffect(() => {
    recharger();
    const minuterie = window.setInterval(() => document.visibilityState === 'visible' && recharger(), PERIODE_MS);
    const auRetour = () => document.visibilityState === 'visible' && recharger();
    document.addEventListener('visibilitychange', auRetour);
    // Le service worker prévient quand une notification push arrive.
    const surMessage = (e: MessageEvent) => e.data?.type === 'notification-recue' && recharger();
    navigator.serviceWorker?.addEventListener('message', surMessage);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener('visibilitychange', auRetour);
      navigator.serviceWorker?.removeEventListener('message', surMessage);
    };
  }, [recharger]);

  // État de l'abonnement push de cet appareil.
  useEffect(() => {
    if (!pushDisponible()) return;
    if (Notification.permission === 'denied') {
      setPush('refuse');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((abonnement) => {
        setPush(abonnement ? 'actif' : 'inactif');
        // L'abonnement existe côté navigateur : on le (ré)enregistre, il peut
        // appartenir à la personne qui vient de se connecter.
        if (abonnement) abonnerPush(abonnement.toJSON()).catch(() => undefined);
      })
      .catch(() => setPush('inactif'));
  }, []);

  const activerPush = useCallback(async () => {
    if (!pushDisponible()) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPush(permission === 'denied' ? 'refuse' : 'inactif');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const { cle } = await clePush();
    const abonnement =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versUint8(cle) }));
    await abonnerPush(abonnement.toJSON());
    setPush('actif');
  }, []);

  const desactiverPush = useCallback(async () => {
    if (!pushDisponible()) return;
    const reg = await navigator.serviceWorker.ready;
    const abonnement = await reg.pushManager.getSubscription();
    if (abonnement) {
      await desabonnerPush(abonnement.endpoint).catch(() => undefined);
      await abonnement.unsubscribe();
    }
    setPush('inactif');
  }, []);

  const marquerLue = useCallback((id: number) => {
    setNotifications((liste) => liste.map((n) => (n.id === id ? { ...n, lue: true } : n)));
    setNonLues((n) => Math.max(0, n - 1));
    marquerNotificationLue(id).catch(() => undefined);
  }, []);

  const toutLire = useCallback(() => {
    setNotifications((liste) => liste.map((n) => ({ ...n, lue: true })));
    setNonLues(0);
    toutMarquerLu().catch(() => undefined);
  }, []);

  return (
    <Contexte.Provider value={{ notifications, nonLues, recharger, marquerLue, toutLire, push, activerPush, desactiverPush }}>
      {children}
    </Contexte.Provider>
  );
}

export function useNotifications(): Etat {
  const etat = useContext(Contexte);
  if (!etat) throw new Error('useNotifications doit être utilisé sous <NotificationsProvider>.');
  return etat;
}

/** Même chose, sans exiger le fournisseur (écrans hors session). */
export function useNotificationsOptionnelles(): Etat | null {
  return useContext(Contexte);
}
