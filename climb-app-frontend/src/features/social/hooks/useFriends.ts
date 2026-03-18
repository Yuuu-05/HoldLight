import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import {
  cancelFriendRequestApi,
  getFriendNetworkApi,
  removeFriendApi,
  respondFriendRequestApi,
  sendFriendRequestApi,
} from '../../../shared/api/friends.api';
import type { FriendRequest, SocialUser } from '../../../shared/types/friend';

interface FriendNetworkState {
  friends: SocialUser[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  suggestions: SocialUser[];
}

const emptyState: FriendNetworkState = {
  friends: [],
  incoming: [],
  outgoing: [],
  suggestions: [],
};

export function useFriends() {
  const { user } = useAuth();
  const [state, setState] = useState<FriendNetworkState>(emptyState);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const next = await getFriendNetworkApi(user);
      setState({
        friends: next.friends,
        incoming: next.incoming,
        outgoing: next.outgoing,
        suggestions: next.suggestions,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendRequest = useCallback(
    async (targetUserId: string) => {
      if (!user) return;
      await sendFriendRequestApi(user, targetUserId);
      await refresh();
    },
    [refresh, user],
  );

  const respondToRequest = useCallback(
    async (requestId: string, status: 'accepted' | 'rejected') => {
      if (!user) return;
      const userId = user._id || user.id || user.email;
      await respondFriendRequestApi(requestId, userId, status);
      await refresh();
    },
    [refresh, user],
  );

  const cancelRequest = useCallback(
    async (requestId: string) => {
      if (!user) return;
      const userId = user._id || user.id || user.email;
      await cancelFriendRequestApi(requestId, userId);
      await refresh();
    },
    [refresh, user],
  );

  const removeFriend = useCallback(
    async (friendUserId: string) => {
      if (!user) return;
      await removeFriendApi(user, friendUserId);
      await refresh();
    },
    [refresh, user],
  );

  return {
    ...state,
    loading,
    refresh,
    sendRequest,
    respondToRequest,
    cancelRequest,
    removeFriend,
  };
}
