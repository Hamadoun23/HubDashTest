/** Notifications du hub (service identity). */
import { apiFetch } from './client';

export type NotificationHub = {
  id: number;
  application: string;
  titre: string;
  message: string;
  lien: string;
  cree_le: string;
  lue: boolean;
};

export type ListeNotifications = { non_lues: number; resultats: NotificationHub[] };

export const listerNotifications = () => apiFetch<ListeNotifications>('/identity/notifications');
export const marquerNotificationLue = (id: number) =>
  apiFetch<void>(`/identity/notifications/${id}/lue`, { method: 'POST' });
export const toutMarquerLu = () => apiFetch<void>('/identity/notifications/tout-lire', { method: 'POST' });

export const clePush = () => apiFetch<{ cle: string }>('/identity/notifications/push/cle');
export const abonnerPush = (abonnement: PushSubscriptionJSON) =>
  apiFetch<void>('/identity/notifications/push/abonnement', { method: 'POST', corps: abonnement });
export const desabonnerPush = (endpoint: string) =>
  apiFetch<void>('/identity/notifications/push/desabonnement', { method: 'POST', corps: { endpoint } });
