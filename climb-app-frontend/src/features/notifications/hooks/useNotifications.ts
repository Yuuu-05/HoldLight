import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import {
  getNotificationsApi,
  markNotificationsReadApi,
  type BackendNotification,
} from '../../../shared/api/notifications.api';
import { routes } from '../../../shared/constants/routes';
import { readStorage, storageKeys, writeStorage } from '../../../shared/lib/storage';
import { useTutorialProgress } from '../../tutorial/hooks/useTutorialProgress';
import { useFeed } from '../../social/hooks/useFeed';
import { useFriends } from '../../social/hooks/useFriends';
import { useRooms } from '../../social/hooks/useRooms';
import { useVolunteerBoard } from '../../volunteer/hooks/useVolunteerBoard';

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
  const count = Number(item.data.count ?? 0);

  switch (item.type) {
    case 'profile_incomplete':
      return {
        id: item.id,
        title: t('Complete your profile'),
        body: t('Add your basic details so role-based guidance and accessibility settings work properly.'),
        to: item.to,
      };
    case 'tutorial_progress': {
      const completedCount = Number(item.data.completedCount ?? 0);
      const totalCount = Number(item.data.totalCount ?? 0);
      return {
        id: item.id,
        title: t('Continue beginner tutorials'),
        body: `${completedCount} / ${totalCount} ${t('modules completed.')}`,
        to: item.to,
      };
    }
    case 'social_activity':
      return {
        id: item.id,
        title: t('New activity on your posts'),
        body: `${count} ${t('of your posts have comments to review.')}`,
        to: item.to,
      };
    case 'friend_requests':
      return {
        id: item.id,
        title: t('New friend requests'),
        body: `${count} ${t('requests are waiting for your response.')}`,
        to: item.to,
      };
    case 'volunteer_interest':
      return {
        id: item.id,
        title: t('Volunteer interest received'),
        body: `${count} ${t('of your support requests now have interested volunteers.')}`,
        to: item.to,
      };
    case 'upcoming_session': {
      const sessionTitle = String(item.data.title ?? '');
      return {
        id: item.id,
        title: t('Upcoming support session'),
        body: `${sessionTitle} ${t('is scheduled soon.')}`,
        to: item.to,
      };
    }
    case 'room_invitations':
      return {
        id: item.id,
        title: t('Room invitations'),
        body: `${count} ${t('climbing room invites are waiting for you.')}`,
        to: item.to,
      };
    default:
      return null;
  }
}

export function useNotifications() {
  const { isAuthenticated, isOnboarded, isUsingDevAuth } = useAuth();
  const { t } = useLanguage();
  const tutorialProgress = useTutorialProgress();
  const feed = useFeed();
  const friends = useFriends();
  const rooms = useRooms();
  const volunteerBoard = useVolunteerBoard();
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
    const tutorialTotal = tutorialProgress.completedCount + tutorialProgress.remainingCount;

    if (!isOnboarded) {
      items.push({
        id: 'profile-incomplete',
        title: t('Complete your profile'),
        body: t('Add your basic details so role-based guidance and accessibility settings work properly.'),
        to: routes.onboarding,
      });
    }

    if (!tutorialProgress.isComplete) {
      items.push({
        id: `tutorial-progress:${tutorialProgress.completedCount}:${tutorialTotal}`,
        title: t('Continue beginner tutorials'),
        body: `${tutorialProgress.completedCount} / ${tutorialTotal} ${t('modules completed.')}`,
        to: routes.tutorialHome,
      });
    }

    if (feed.postsWithActivity.length) {
      items.push({
        id: `social-activity:${feed.postsWithActivity.length}`,
        title: t('New activity on your posts'),
        body: `${feed.postsWithActivity.length} ${t('of your posts have comments to review.')}`,
        to: routes.myPosts,
      });
    }

    const pendingRequests = friends.incoming.filter((request) => request.status === 'pending').length;
    if (pendingRequests) {
      items.push({
        id: `friend-requests:${pendingRequests}`,
        title: t('New friend requests'),
        body: `${pendingRequests} ${t('requests are waiting for your response.')}`,
        to: routes.socialFriends,
      });
    }

    const requestsWithApplicants = volunteerBoard.myRequests.filter((item) =>
      item.applicants.some((application) => ['interested', 'accepted'].includes(application.status)),
    );
    if (requestsWithApplicants.length) {
      items.push({
        id: `volunteer-interest:${requestsWithApplicants.length}`,
        title: t('Volunteer interest received'),
        body: `${requestsWithApplicants.length} ${t('of your support requests now have interested volunteers.')}`,
        to: routes.contactIntent,
      });
    }

    if (volunteerBoard.upcomingSessions.length) {
      const nextSession = volunteerBoard.upcomingSessions[0];
      items.push({
        id: `upcoming-session:${nextSession.id}:${nextSession.sessionTime}`,
        title: t('Upcoming support session'),
        body: `${nextSession.title} ${t('is scheduled soon.')}`,
        to: routes.volunteerMySessions,
      });
    }

    const pendingInvitations = rooms.invitations.filter((invite) => invite.status === 'pending').length;
    if (pendingInvitations) {
      items.push({
        id: `room-invitations:${pendingInvitations}`,
        title: t('Room invitations'),
        body: `${pendingInvitations} ${t('climbing room invites are waiting for you.')}`,
        to: routes.socialRooms,
      });
    }

    return items;
  }, [
    feed.postsWithActivity,
    friends.incoming,
    isAuthenticated,
    isOnboarded,
    rooms.invitations,
    t,
    tutorialProgress.completedCount,
    tutorialProgress.isComplete,
    tutorialProgress.remainingCount,
    volunteerBoard.myRequests,
    volunteerBoard.upcomingSessions,
  ]);

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
  }, [
    feed.postsWithActivity.length,
    friends.incoming.length,
    isAuthenticated,
    isUsingDevAuth,
    rooms.invitations.length,
    t,
    tutorialProgress.completedCount,
    tutorialProgress.remainingCount,
    volunteerBoard.myRequests.length,
    volunteerBoard.upcomingSessions.length,
  ]);

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
    loading: remoteLoading || feed.loading || volunteerBoard.loading,
    markAsRead,
    markAllAsRead,
  };
}
