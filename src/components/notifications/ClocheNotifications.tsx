import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { NotificationHub } from '../../lib/api/notifications';
import { useCommercialExterne } from '../../lib/auth/commercialExterne';
import { useNotificationsOptionnelles } from '../../lib/notifications/NotificationsContext';

const NOMS_APPS: Record<string, string> = {
  hub: 'GDA Hub',
  rh: 'RH & Finance',
  finance: 'Finance',
  orange: "Jus d'orange",
  daily: 'Chantiers',
  planning: 'Planning',
  campagnes: 'Campagnes',
};

export function ilYa(dateIso: string) {
  const secondes = Math.max(0, (Date.now() - new Date(dateIso).getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  if (secondes < 7 * 86400) return `il y a ${Math.floor(secondes / 86400)} j`;
  return new Date(dateIso).toLocaleDateString('fr-FR');
}

export function LigneNotification({ n, onOuvrir }: { n: NotificationHub; onOuvrir: (n: NotificationHub) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOuvrir(n)}
      className={`flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface2 ${n.lue ? 'opacity-70' : ''}`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lue ? 'bg-transparent' : 'bg-accent'}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{NOMS_APPS[n.application] ?? n.application}</span>
          <span className="shrink-0 text-[11px] text-muted">{ilYa(n.cree_le)}</span>
        </span>
        <span className="mt-0.5 block text-sm font-semibold text-white">{n.titre}</span>
        {n.message && <span className="mt-0.5 block text-xs text-muted">{n.message}</span>}
      </span>
    </button>
  );
}

/** Ouvre la page visée par une notification (et la marque comme lue). */
export function useOuvrirNotification() {
  const navigate = useNavigate();
  const etat = useNotificationsOptionnelles();
  return (n: NotificationHub) => {
    if (!n.lue) etat?.marquerLue(n.id);
    if (n.lien?.startsWith('/')) navigate(n.lien);
  };
}

export function BoutonActiverPush() {
  const etat = useNotificationsOptionnelles();
  const [erreur, setErreur] = useState(false);
  if (!etat || etat.push !== 'inactif') return null;
  return (
    <button
      type="button"
      onClick={() => etat.activerPush().catch(() => setErreur(true))}
      className="flex w-full items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-left text-xs font-medium text-accent2 transition hover:bg-accent/20"
    >
      <BellRing size={14} className="shrink-0" />
      {erreur ? "Impossible d'activer les notifications sur cet appareil." : 'Recevoir les notifications sur cet appareil'}
    </button>
  );
}

export function ClocheNotifications() {
  const etat = useNotificationsOptionnelles();
  const externe = useCommercialExterne();
  const ouvrirNotification = useOuvrirNotification();
  const [ouvert, setOuvert] = useState(false);
  if (!etat) return null;
  const { notifications, nonLues, toutLire } = etat;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-label={nonLues ? `Notifications, ${nonLues} non lue${nonLues > 1 ? 's' : ''}` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface2 text-muted backdrop-blur-sm transition hover:text-white"
      >
        <Bell size={17} />
        {nonLues > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOuvert(false)} />
          <div className="fixed inset-x-3 top-16 z-40 rounded-2xl border border-border bg-[#1a130e]/95 p-2 shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="font-display text-sm font-bold text-white">Notifications</p>
              {nonLues > 0 && (
                <button type="button" onClick={toutLire} className="flex items-center gap-1 text-xs font-medium text-accent2 hover:text-white">
                  <CheckCheck size={14} /> Tout marquer comme lu
                </button>
              )}
            </div>
            <div className="px-1 pb-1">
              <BoutonActiverPush />
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">Aucune notification pour le moment.</p>
              ) : (
                notifications.slice(0, 12).map((n) => (
                  <LigneNotification
                    key={n.id}
                    n={n}
                    onOuvrir={(x) => {
                      setOuvert(false);
                      ouvrirNotification(x);
                    }}
                  />
                ))
              )}
            </div>
            {!externe && notifications.length > 0 && (
              <Link
                to="/notifications"
                onClick={() => setOuvert(false)}
                className="mt-1 block rounded-xl px-3 py-2 text-center text-xs font-semibold text-muted hover:bg-surface2 hover:text-white"
              >
                Voir toutes les notifications
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
