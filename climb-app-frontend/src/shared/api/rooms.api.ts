import type { User } from '../types/user';
import type {
  ClimbingRoom,
  RoomInvitation,
  RoomInvitationStatus,
  RoomMember,
  RoomMessage,
  RoomMessageType,
  RoomReadState,
} from '../types/room';
import type { SocialUser } from '../types/friend';
import { readStorage, storageKeys, writeStorage } from '../lib/storage';
import { getSocialUsersApi } from './friends.api';
import { apiClient } from './client';

const DEV_TOKEN_PREFIX = 'dev-auth-token:';

function useLocalRoomApi() {
  const token = readStorage<string | null>(storageKeys.token, null);
  return Boolean(token?.startsWith(DEV_TOKEN_PREFIX));
}

function getActorId(user: User) {
  return user._id || user.id || user.email;
}

function toMember(user: User): RoomMember {
  return {
    userId: getActorId(user),
    userName: user.username,
    role: user.role,
    joinedAt: new Date().toISOString(),
  };
}

function toReadState(userId: string, lastReadAt = new Date().toISOString()): RoomReadState {
  return {
    userId,
    lastReadAt,
  };
}

const seedRooms: ClimbingRoom[] = [
  {
    id: 'room-seed-1',
    title: 'Saturday Beginner Warmup Group',
    gymName: 'XJTLU Indoor Wall',
    region: 'Suzhou',
    description: 'Friendly warmup room for beginners looking for voice guidance, partners, and route practice.',
    createdById: 'seed-user-3',
    createdByName: 'Amy Zhao',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    members: [
      {
        userId: 'seed-user-3',
        userName: 'Amy Zhao',
        role: 'volunteer',
        joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      },
      {
        userId: 'seed-user-1',
        userName: 'Li Wen',
        role: 'visually_impaired',
        joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
      },
    ],
    invitations: [],
    messages: [
      {
        id: 'room-message-seed-1',
        userId: 'seed-user-3',
        userName: 'Amy Zhao',
        body: 'Welcome. This room is for warmup plans, practice partners, and quick help requests.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
        type: 'plan',
      },
    ],
    readStates: [
      toReadState('seed-user-3', new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString()),
      toReadState('seed-user-1', new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()),
    ],
  },
];

function loadRooms() {
  const stored = readStorage<ClimbingRoom[]>(storageKeys.climbingRooms, []);
  if (stored.length) return stored;
  writeStorage(storageKeys.climbingRooms, seedRooms);
  return seedRooms;
}

function saveRooms(items: ClimbingRoom[]) {
  writeStorage(storageKeys.climbingRooms, items);
  return items;
}

function isMember(room: ClimbingRoom, userId: string) {
  return room.members.some((member) => member.userId === userId);
}

function findDirectoryUser(users: SocialUser[], userId: string) {
  return users.find((user) => user.userId === userId);
}

async function getLocalRoomById(roomId: string) {
  return loadRooms().find((room) => room.id === roomId) ?? null;
}

export async function getRoomsApi() {
  if (useLocalRoomApi()) {
    return loadRooms().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const { data } = await apiClient.get<{ success: boolean; rooms: ClimbingRoom[] }>('/rooms');
  return data.rooms.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRoomByIdApi(roomId: string) {
  if (useLocalRoomApi()) {
    return getLocalRoomById(roomId);
  }

  const { data } = await apiClient.get<{ success: boolean; room: ClimbingRoom }>(`/rooms/${roomId}`);
  return data.room;
}

export async function createRoomApi(
  currentUser: User,
  input: Pick<ClimbingRoom, 'title' | 'gymName' | 'region' | 'description'>,
) {
  if (useLocalRoomApi()) {
    const rooms = loadRooms();
    const room: ClimbingRoom = {
      id: crypto.randomUUID(),
      ...input,
      createdById: getActorId(currentUser),
      createdByName: currentUser.username,
      createdAt: new Date().toISOString(),
      members: [toMember(currentUser)],
      invitations: [],
      messages: [
        {
          id: crypto.randomUUID(),
          userId: getActorId(currentUser),
          userName: currentUser.username,
          body: 'Room created. Use this space to chat, ask for help, and invite friends to practice.',
          createdAt: new Date().toISOString(),
          type: 'plan',
        },
      ],
      readStates: [toReadState(getActorId(currentUser))],
    };
    saveRooms([room, ...rooms]);
    return room;
  }

  const { data } = await apiClient.post<{ success: boolean; room: ClimbingRoom }>('/rooms', input);
  return data.room;
}

export async function joinRoomApi(roomId: string, currentUser: User) {
  if (useLocalRoomApi()) {
    const rooms = loadRooms();
    const userId = getActorId(currentUser);
    const next = rooms.map((room) => {
      if (room.id !== roomId || isMember(room, userId)) return room;
      return {
        ...room,
        members: [...room.members, toMember(currentUser)],
        messages: [
          ...room.messages,
          {
            id: crypto.randomUUID(),
            userId,
            userName: currentUser.username,
            body: `${currentUser.username} joined the room.`,
            createdAt: new Date().toISOString(),
            type: 'plan' as const,
          },
        ],
        readStates: [...room.readStates, toReadState(userId)],
      };
    });
    saveRooms(next);
    return next.find((room) => room.id === roomId) ?? null;
  }

  const { data } = await apiClient.post<{ success: boolean; room: ClimbingRoom }>(`/rooms/${roomId}/join`);
  return data.room;
}

export async function inviteFriendToRoomApi(roomId: string, currentUser: User, friendUserId: string) {
  if (useLocalRoomApi()) {
    const rooms = loadRooms();
    const users = await getSocialUsersApi(currentUser);
    const friend = findDirectoryUser(users, friendUserId);

    if (!friend) {
      throw new Error('Friend not found.');
    }

    const next = rooms.map((room) => {
      if (room.id !== roomId) return room;
      const alreadyInvited = room.invitations.some(
        (invite) => invite.invitedUserId === friendUserId && invite.status === 'pending',
      );
      if (alreadyInvited || isMember(room, friendUserId)) {
        return room;
      }

      const invitation: RoomInvitation = {
        id: crypto.randomUUID(),
        roomId: room.id,
        roomName: room.title,
        invitedUserId: friend.userId,
        invitedUserName: friend.username,
        invitedById: getActorId(currentUser),
        invitedByName: currentUser.username,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      return {
        ...room,
        invitations: [...room.invitations, invitation],
        messages: [
          ...room.messages,
          {
            id: crypto.randomUUID(),
            userId: getActorId(currentUser),
            userName: currentUser.username,
            body: `${currentUser.username} invited ${friend.username} to join the room.`,
            createdAt: new Date().toISOString(),
            type: 'plan' as const,
          },
        ],
      };
    });

    saveRooms(next);
    return next.find((room) => room.id === roomId) ?? null;
  }

  const { data } = await apiClient.post<{ success: boolean; room: ClimbingRoom }>(
    `/rooms/${roomId}/invitations`,
    { friendUserId },
  );
  return data.room;
}

export async function respondRoomInvitationApi(
  roomId: string,
  invitationId: string,
  currentUser: User,
  status: RoomInvitationStatus,
) {
  if (useLocalRoomApi()) {
    const rooms = loadRooms();
    const userId = getActorId(currentUser);

    const next = rooms.map((room) => {
      if (room.id !== roomId) return room;

      const invitation = room.invitations.find(
        (item) => item.id === invitationId && item.invitedUserId === userId,
      );
      if (!invitation) return room;

      const nextInvitations = room.invitations.map((item) =>
        item.id === invitationId
          ? {
              ...item,
              status,
              respondedAt: new Date().toISOString(),
            }
          : item,
      );

      const nextMembers =
        status === 'accepted' && !isMember(room, userId)
          ? [...room.members, toMember(currentUser)]
          : room.members;

      const nextMessages =
        status === 'accepted'
          ? [
              ...room.messages,
              {
                id: crypto.randomUUID(),
                userId,
                userName: currentUser.username,
                body: `${currentUser.username} accepted the invitation and joined the room.`,
                createdAt: new Date().toISOString(),
                type: 'plan' as const,
              },
            ]
          : room.messages;

      return {
        ...room,
        invitations: nextInvitations,
        members: nextMembers,
        messages: nextMessages,
        readStates:
          status === 'accepted' && !room.readStates.some((item) => item.userId === userId)
            ? [...room.readStates, toReadState(userId)]
            : room.readStates,
      };
    });

    saveRooms(next);
    return next.find((room) => room.id === roomId) ?? null;
  }

  const { data } = await apiClient.patch<{ success: boolean; room: ClimbingRoom }>(
    `/rooms/${roomId}/invitations/${invitationId}`,
    { status },
  );
  return data.room;
}

export async function withdrawRoomInvitationApi(roomId: string, invitationId: string, currentUser: User) {
  if (useLocalRoomApi()) {
    const rooms = loadRooms();
    const userId = getActorId(currentUser);
    let changed = false;

    const next = rooms.map((room) => {
      if (room.id !== roomId) return room;

      const invitation = room.invitations.find(
        (item) =>
          item.id === invitationId &&
          item.status === 'pending' &&
          (item.invitedById === userId || room.createdById === userId),
      );

      if (!invitation) return room;
      changed = true;

      return {
        ...room,
        invitations: room.invitations.filter((item) => item.id !== invitationId),
        messages: [
          ...room.messages,
          {
            id: crypto.randomUUID(),
            userId,
            userName: currentUser.username,
            body: `${currentUser.username} withdrew the invitation for ${invitation.invitedUserName}.`,
            createdAt: new Date().toISOString(),
            type: 'plan' as const,
          },
        ],
      };
    });

    if (!changed) {
      throw new Error('Pending invitation not found.');
    }

    saveRooms(next);
    return next.find((room) => room.id === roomId) ?? null;
  }

  const { data } = await apiClient.delete<{ success: boolean; room: ClimbingRoom }>(
    `/rooms/${roomId}/invitations/${invitationId}`,
  );
  return data.room;
}

export async function sendRoomMessageApi(
  roomId: string,
  currentUser: User,
  body: string,
  type: RoomMessageType = 'chat',
) {
  if (useLocalRoomApi()) {
    const rooms = loadRooms();
    const userId = getActorId(currentUser);

    const next = rooms.map((room) => {
      if (room.id !== roomId || !isMember(room, userId)) return room;

      const message: RoomMessage = {
        id: crypto.randomUUID(),
        userId,
        userName: currentUser.username,
        body,
        createdAt: new Date().toISOString(),
        type,
      };

      return {
        ...room,
        messages: [...room.messages, message],
        readStates: room.readStates.map((item) =>
          item.userId === userId
            ? { ...item, lastReadAt: new Date().toISOString() }
            : item,
        ),
      };
    });

    saveRooms(next);
    return next.find((room) => room.id === roomId) ?? null;
  }

  const { data } = await apiClient.post<{ success: boolean; room: ClimbingRoom }>(
    `/rooms/${roomId}/messages`,
    { body, type },
  );
  return data.room;
}

export async function markRoomAsReadApi(roomId: string, currentUser: User) {
  if (useLocalRoomApi()) {
    const rooms = loadRooms();
    const userId = getActorId(currentUser);
    const now = new Date().toISOString();

    const next = rooms.map((room) => {
      if (room.id !== roomId || !isMember(room, userId)) return room;

      const hasReadState = room.readStates.some((item) => item.userId === userId);
      return {
        ...room,
        readStates: hasReadState
          ? room.readStates.map((item) =>
              item.userId === userId ? { ...item, lastReadAt: now } : item,
            )
          : [...room.readStates, toReadState(userId, now)],
      };
    });

    saveRooms(next);
    return next.find((room) => room.id === roomId) ?? null;
  }

  const { data } = await apiClient.post<{ success: boolean; room: ClimbingRoom }>(`/rooms/${roomId}/read`);
  return data.room;
}
