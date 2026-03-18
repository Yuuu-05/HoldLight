import type { User } from '../types/user';
import type { FriendRequest, FriendRequestStatus, SocialUser } from '../types/friend';
import { readStorage, storageKeys, writeStorage } from '../lib/storage';
import { apiClient } from './client';

const DEV_TOKEN_PREFIX = 'dev-auth-token:';

const seedSocialUsers: SocialUser[] = [
  {
    userId: 'seed-user-1',
    username: 'Li Wen',
    role: 'visually_impaired',
    email: 'liwen@local.test',
    homeGym: 'XJTLU Indoor Wall',
    region: 'Suzhou',
    accessibilityNeeds: 'Voice guidance and clear focus order',
  },
  {
    userId: 'seed-user-2',
    username: 'Daniel Chen',
    role: 'experienced',
    email: 'daniel@local.test',
    homeGym: 'Suzhou Climb Center',
    region: 'Suzhou',
  },
  {
    userId: 'seed-user-3',
    username: 'Amy Zhao',
    role: 'volunteer',
    email: 'amy@local.test',
    homeGym: 'XJTLU Indoor Wall',
    region: 'Suzhou',
  },
  {
    userId: 'seed-user-4',
    username: 'Kevin Wu',
    role: 'new_user',
    email: 'kevin@local.test',
    homeGym: 'Shanghai North Gym',
    region: 'Shanghai',
  },
];

const seedFriendRequests: FriendRequest[] = [
  {
    id: 'friend-seed-1',
    fromUserId: 'seed-user-2',
    fromUserName: 'Daniel Chen',
    toUserId: 'dev-new_user',
    toUserName: 'dev_new_user',
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
];

function useLocalFriendApi() {
  const token = readStorage<string | null>(storageKeys.token, null);
  return Boolean(token?.startsWith(DEV_TOKEN_PREFIX));
}

function getActorId(user: User) {
  return user._id || user.id || user.email;
}

function toSocialUser(user: User): SocialUser {
  return {
    userId: getActorId(user),
    username: user.username,
    role: user.role,
    email: user.email,
    homeGym: 'XJTLU Indoor Wall',
    region: 'Suzhou',
    accessibilityNeeds: user.profile?.accessibilityNeeds,
  };
}

function loadSocialUsers() {
  const stored = readStorage<SocialUser[]>(storageKeys.socialUsers, []);
  if (stored.length) return stored;
  writeStorage(storageKeys.socialUsers, seedSocialUsers);
  return seedSocialUsers;
}

function saveSocialUsers(users: SocialUser[]) {
  writeStorage(storageKeys.socialUsers, users);
  return users;
}

function loadFriendRequests() {
  const stored = readStorage<FriendRequest[]>(storageKeys.friendRequests, []);
  if (stored.length) return stored;
  writeStorage(storageKeys.friendRequests, seedFriendRequests);
  return seedFriendRequests;
}

function saveFriendRequests(items: FriendRequest[]) {
  writeStorage(storageKeys.friendRequests, items);
  return items;
}

function ensureSocialUser(user?: User | null) {
  if (!user) return loadSocialUsers();
  const items = loadSocialUsers();
  const candidate = toSocialUser(user);
  const next = items.some((item) => item.userId === candidate.userId)
    ? items.map((item) => (item.userId === candidate.userId ? { ...item, ...candidate } : item))
    : [candidate, ...items];
  saveSocialUsers(next);
  return next;
}

function getAcceptedFriendIds(userId: string, requests: FriendRequest[]) {
  return requests.flatMap((request) => {
    if (request.status !== 'accepted') return [];
    if (request.fromUserId === userId) return [request.toUserId];
    if (request.toUserId === userId) return [request.fromUserId];
    return [];
  });
}

function getRequestBetween(requests: FriendRequest[], firstUserId: string, secondUserId: string) {
  return requests.find(
    (request) =>
      (request.fromUserId === firstUserId && request.toUserId === secondUserId) ||
      (request.fromUserId === secondUserId && request.toUserId === firstUserId),
  );
}

async function getLocalFriendNetwork(currentUser: User) {
  const userId = getActorId(currentUser);
  const users = ensureSocialUser(currentUser);
  const requests = loadFriendRequests();

  const incoming = requests.filter((request) => request.toUserId === userId);
  const outgoing = requests.filter((request) => request.fromUserId === userId);
  const friendIds = getAcceptedFriendIds(userId, requests);
  const friends = users.filter((candidate) => friendIds.includes(candidate.userId));

  const suggestions = users.filter((candidate) => {
    if (candidate.userId === userId) return false;
    if (friendIds.includes(candidate.userId)) return false;
    const existing = getRequestBetween(requests, userId, candidate.userId);
    return !existing || existing.status === 'rejected';
  });

  return {
    users,
    friends,
    incoming,
    outgoing,
    suggestions,
  };
}

export async function getSocialUsersApi(currentUser?: User | null) {
  if (useLocalFriendApi()) {
    return ensureSocialUser(currentUser);
  }

  const { data } = await apiClient.get<{
    success: boolean;
    users: SocialUser[];
  }>('/friends/network');
  return data.users;
}

export async function getFriendNetworkApi(currentUser: User) {
  if (useLocalFriendApi()) {
    return getLocalFriendNetwork(currentUser);
  }

  const { data } = await apiClient.get<{
    success: boolean;
    users: SocialUser[];
    friends: SocialUser[];
    incoming: FriendRequest[];
    outgoing: FriendRequest[];
    suggestions: SocialUser[];
  }>('/friends/network');

  return data;
}

export async function sendFriendRequestApi(currentUser: User, targetUserId: string) {
  if (useLocalFriendApi()) {
    const requests = loadFriendRequests();
    const users = ensureSocialUser(currentUser);
    const currentUserId = getActorId(currentUser);

    if (currentUserId === targetUserId) {
      throw new Error('You cannot send a friend request to yourself.');
    }

    const existing = getRequestBetween(requests, currentUserId, targetUserId);
    if (existing && existing.status === 'pending') {
      throw new Error('A pending friend request already exists.');
    }
    if (existing && existing.status === 'accepted') {
      throw new Error('You are already friends with this user.');
    }

    const target = users.find((item) => item.userId === targetUserId);
    if (!target) {
      throw new Error('The selected user could not be found.');
    }

    const nextRequest: FriendRequest = {
      id: crypto.randomUUID(),
      fromUserId: currentUserId,
      fromUserName: currentUser.username,
      toUserId: targetUserId,
      toUserName: target.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    saveFriendRequests([nextRequest, ...requests.filter((request) => request.id !== existing?.id)]);
    return nextRequest;
  }

  const { data } = await apiClient.post<{
    success: boolean;
    request: FriendRequest;
  }>('/friends/requests', { targetUserId });
  return data.request;
}

export async function respondFriendRequestApi(
  requestId: string,
  responderId: string,
  status: Exclude<FriendRequestStatus, 'pending'>,
) {
  if (useLocalFriendApi()) {
    const requests = loadFriendRequests();
    const next = requests.map((request) => {
      if (request.id !== requestId || request.toUserId !== responderId) return request;
      return {
        ...request,
        status,
        respondedAt: new Date().toISOString(),
      };
    });
    saveFriendRequests(next);
    return next.find((request) => request.id === requestId) ?? null;
  }

  const { data } = await apiClient.patch<{
    success: boolean;
    request: FriendRequest;
  }>(`/friends/requests/${requestId}`, { status });
  return data.request;
}

export async function cancelFriendRequestApi(requestId: string, currentUserId: string) {
  if (useLocalFriendApi()) {
    const requests = loadFriendRequests();
    const next = requests.filter(
      (request) => !(request.id === requestId && request.fromUserId === currentUserId && request.status === 'pending'),
    );

    if (next.length === requests.length) {
      throw new Error('Pending outgoing friend request not found.');
    }

    saveFriendRequests(next);
    return true;
  }

  await apiClient.delete(`/friends/requests/${requestId}`);
  return true;
}

export async function removeFriendApi(currentUser: User, friendUserId: string) {
  if (useLocalFriendApi()) {
    const currentUserId = getActorId(currentUser);
    const requests = loadFriendRequests();
    const next = requests.filter((request) => {
      const isPair =
        (request.fromUserId === currentUserId && request.toUserId === friendUserId) ||
        (request.fromUserId === friendUserId && request.toUserId === currentUserId);
      return !isPair;
    });

    if (next.length === requests.length) {
      throw new Error('Friendship not found.');
    }

    saveFriendRequests(next);
    return true;
  }

  await apiClient.delete(`/friends/${friendUserId}`);
  return true;
}
