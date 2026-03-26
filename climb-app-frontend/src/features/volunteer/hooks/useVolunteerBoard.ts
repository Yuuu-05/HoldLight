import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { getVolunteerPostsApi } from '../../../shared/api/volunteers.api';
import type { VolunteerPostItem } from '../../../shared/types/volunteer';

export function useVolunteerBoard() {
  const { user } = useAuth();
  const [items, setItems] = useState<VolunteerPostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextItems = await getVolunteerPostsApi();
      setItems(nextItems);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const userId = user?._id || user?.id || user?.email || '';

  return useMemo(
    () => ({
      items,
      loading,
      refresh,
      myRequests: items.filter((item) => item.authorId === userId),
      myInterestedSessions: items.filter((item) =>
        item.applicants.some((app) => app.userId === userId && app.status !== 'cancelled'),
      ),
      upcomingSessions: items
        .filter(
          (item) =>
            item.authorId === userId ||
            item.applicants.some(
              (app) => app.userId === userId && ['accepted', 'completed'].includes(app.status),
            ),
        )
        .sort((a, b) => a.sessionTime.localeCompare(b.sessionTime))
        .slice(0, 3),
    }),
    [items, loading, refresh, userId],
  );
}
