import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import {
  getNotificationsApi,
  markNotificationsReadApi,
  type BackendNotification,
} from '../../../shared/api/notifications.api';
import { readStorage, storageKeys, writeStorage } from '../../../shared/lib/storage';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  to: string;
  isRead: boolean;
}

interface NotificationDraft {
  id: string;
  title: string;
  body: string;
  to: string;
}

function buildBackendNotification(
  item: BackendNotification,
  t: (key: string) => string,
): NotificationDraft | null {
  void item;
  void t;
  return null;
}

export function useNotifications() {
  const { isAuthenticated, isUsingDevAuth } = useAuth();
  const { t } = useLanguage();
  const [remoteNotifications, setRemoteNotifications] = useState<NotificationDraft[]>([]);
  const [remoteReadIds, setRemoteReadIds] = useState<string[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteHydrated, setRemoteHydrated] = useState(false);
  const [localReadIds, setLocalReadIds] = useState<string[]>(() =>
    readStorage<string[]>(storageKeys.notificationReadIds, []),
  );

  const localNotifications = useMemo<NotificationDraft[]>(() => {
    if (!isAuthenticated) return [];

    const items: NotificationDraft[] = [];

    return items;
  }, [isAuthenticated]);

  useEffect(() => {
    writeStorage(storageKeys.notificationReadIds, localReadIds);
  }, [localReadIds]);

  useEffect(() => {
    if (!isAuthenticated || isUsingDevAuth) {
      setRemoteNotifications([]);
      setRemoteReadIds([]);
      setRemoteLoading(false);
      setRemoteHydrated(false);
      return;
    }

    let active = true;
    setRemoteLoading(true);
    getNotificationsApi()
      .then(({ notifications, readIds }) => {
        if (!active) return;
        setRemoteNotifications(
          notifications
            .map((item) => buildBackendNotification(item, t))
            .filter((item): item is NotificationDraft => Boolean(item)),
        );
        setRemoteReadIds(readIds);
      })
      .catch(() => {
        if (!active) return;
        setRemoteNotifications([]);
        setRemoteReadIds([]);
      })
      .finally(() => {
        if (active) {
          setRemoteLoading(false);
          setRemoteHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, isUsingDevAuth, t]);

  const sourceNotifications =
    isAuthenticated && !isUsingDevAuth && remoteHydrated ? remoteNotifications : localNotifications;
  const readIds = isAuthenticated && !isUsingDevAuth && remoteHydrated ? remoteReadIds : localReadIds;

  const notifications = useMemo<AppNotification[]>(
    () =>
      sourceNotifications.map((item) => ({
        ...item,
        isRead: readIds.includes(item.id),
      })),
    [readIds, sourceNotifications],
  );

  const persistReadIds = useCallback(
    async (notificationIds: string[]) => {
      if (!notificationIds.length) return;

      if (isAuthenticated && !isUsingDevAuth && remoteHydrated) {
        const nextReadIds = [...new Set([...remoteReadIds, ...notificationIds])];
        setRemoteReadIds(nextReadIds);
        try {
          const savedReadIds = await markNotificationsReadApi(notificationIds);
          setRemoteReadIds(savedReadIds);
        } catch {
          setRemoteReadIds(nextReadIds);
        }
        return;
      }

      setLocalReadIds((previous) => [...new Set([...previous, ...notificationIds])]);
    },
    [isAuthenticated, isUsingDevAuth, remoteHydrated, remoteReadIds],
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationId || readIds.includes(notificationId)) return;
      await persistReadIds([notificationId]);
    },
    [persistReadIds, readIds],
  );

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((item) => !item.isRead).map((item) => item.id);
    await persistReadIds(unreadIds);
  }, [notifications, persistReadIds]);

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.isRead).length,
    loading: remoteLoading,
    markAsRead,
    markAllAsRead,
  };
}
