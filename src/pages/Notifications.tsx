import { BellOff, CheckCheck } from 'lucide-react';
import { BoutonActiverPush, LigneNotification, useOuvrirNotification } from '../components/notifications/ClocheNotifications';
import { useNotifications } from '../lib/notifications/NotificationsContext';

/** Toutes les notifications récentes de la personne connectée. */
export default function Notifications() {
  const { notifications, nonLues, toutLire, push, desactiverPush } = useNotifications();
  const ouvrir = useOuvrirNotification();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-muted">{nonLues ? `${nonLues} non lue${nonLues > 1 ? 's' : ''}` : 'Tout est lu.'}</p>
        </div>
        {nonLues > 0 && (
          <button
            type="button"
            onClick={toutLire}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white"
          >
            <CheckCheck size={14} /> Tout marquer comme lu
          </button>
        )}
      </div>

      <BoutonActiverPush />
      {push === 'actif' && (
        <button
          type="button"
          onClick={() => desactiverPush()}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white"
        >
          <BellOff size={13} /> Ne plus recevoir les notifications sur cet appareil
        </button>
      )}
      {push === 'refuse' && (
        <p className="text-xs text-muted">
          Les notifications sont bloquées pour ce site dans les réglages du navigateur.
        </p>
      )}

      <div className="rounded-3xl border border-border bg-surface p-2 backdrop-blur-xl">
        {notifications.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted">Aucune notification pour le moment.</p>
        ) : (
          notifications.map((n) => <LigneNotification key={n.id} n={n} onOuvrir={ouvrir} />)
        )}
      </div>
    </div>
  );
}
