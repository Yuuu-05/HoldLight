import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import {
  createRoomApi,
  getRoomsApi,
  inviteFriendToRoomApi,
  joinRoomApi,
  markRoomAsReadApi,
  respondRoomInvitationApi,
  sendRoomMessageApi,
  withdrawRoomInvitationApi,
} from '../../../shared/api/rooms.api';
import type { ClimbingRoom, RoomInvitationStatus, RoomMessageType } from '../../../shared/types/room';

export function useRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ClimbingRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextRooms = await getRoomsApi();
      setRooms(nextRooms);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createRoom = useCallback(
    async (input: Pick<ClimbingRoom, 'title' | 'gymName' | 'region' | 'description'>) => {
      if (!user) return null;
      const room = await createRoomApi(user, input);
      await refresh();
      return room;
    },
    [refresh, user],
  );

  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!user) return null;
      const room = await joinRoomApi(roomId, user);
      await refresh();
      return room;
    },
    [refresh, user],
  );

  const inviteFriend = useCallback(
    async (roomId: string, friendUserId: string) => {
      if (!user) return null;
      const room = await inviteFriendToRoomApi(roomId, user, friendUserId);
      await refresh();
      return room;
    },
    [refresh, user],
  );

  const respondToInvitation = useCallback(
    async (roomId: string, invitationId: string, status: RoomInvitationStatus) => {
      if (!user) return null;
      const room = await respondRoomInvitationApi(roomId, invitationId, user, status);
      await refresh();
      return room;
    },
    [refresh, user],
  );

  const withdrawInvitation = useCallback(
    async (roomId: string, invitationId: string) => {
      if (!user) return null;
      const room = await withdrawRoomInvitationApi(roomId, invitationId, user);
      await refresh();
      return room;
    },
    [refresh, user],
  );

  const markAsRead = useCallback(
    async (roomId: string) => {
      if (!user) return null;
      const room = await markRoomAsReadApi(roomId, user);
      await refresh();
      return room;
    },
    [refresh, user],
  );

  const sendMessage = useCallback(
    async (roomId: string, body: string, type: RoomMessageType = 'chat') => {
      if (!user) return null;
      const room = await sendRoomMessageApi(roomId, user, body, type);
      await refresh();
      return room;
    },
    [refresh, user],
  );

  const userId = user?._id || user?.id || user?.email || '';

  return useMemo(
    () => ({
      rooms,
      loading,
      refresh,
      createRoom,
      joinRoom,
      inviteFriend,
      respondToInvitation,
      withdrawInvitation,
      markAsRead,
      sendMessage,
      myRooms: rooms.filter((room) => room.members.some((member) => member.userId === userId)),
      invitations: rooms.flatMap((room) =>
        room.invitations.filter((invite) => invite.invitedUserId === userId),
      ),
      unreadRoomIds: rooms
        .filter((room) => room.members.some((member) => member.userId === userId))
        .filter((room) => {
          const lastReadAt = room.readStates.find((item) => item.userId === userId)?.lastReadAt ?? '';
          return room.messages.some(
            (message) => message.userId !== userId && message.createdAt > lastReadAt,
          );
        })
        .map((room) => room.id),
    }),
    [
      createRoom,
      inviteFriend,
      joinRoom,
      loading,
      markAsRead,
      refresh,
      respondToInvitation,
      rooms,
      sendMessage,
      userId,
      withdrawInvitation,
    ],
  );
}
