import type { User } from '../types/user';
import { readStorage, storageKeys, writeStorage } from '../lib/storage';
import type { VolunteerApplication, VolunteerPostItem } from '../types/volunteer';
import { apiClient } from './client';

const DEV_TOKEN_PREFIX = 'dev-auth-token:';

const seedVolunteerPosts: VolunteerPostItem[] = [
  {
    id: 'vol-1',
    title: 'Need a volunteer guide for Saturday beginner session',
    location: 'XJTLU Indoor Wall',
    sessionTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    difficulty: 'Beginner',
    notes: 'Looking for someone patient who can help with route preview and spoken cues.',
    authorId: 'seed-user-1',
    authorName: 'Li Wen',
    applicants: [],
    createdAt: new Date().toISOString(),
  },
];

function useLocalVolunteerApi() {
  const token = readStorage<string | null>(storageKeys.token, null);
  return Boolean(token?.startsWith(DEV_TOKEN_PREFIX));
}

function loadVolunteerPosts() {
  const stored = readStorage<VolunteerPostItem[]>(storageKeys.volunteerPosts, []);
  if (stored.length) return stored;
  writeStorage(storageKeys.volunteerPosts, seedVolunteerPosts);
  return seedVolunteerPosts;
}

function saveVolunteerPosts(items: VolunteerPostItem[]) {
  writeStorage(storageKeys.volunteerPosts, items);
  return items;
}

function updateLocalVolunteerPost(
  postId: string,
  updater: (item: VolunteerPostItem) => VolunteerPostItem,
) {
  const nextItems = loadVolunteerPosts().map((item) => (item.id === postId ? updater(item) : item));
  saveVolunteerPosts(nextItems);
  return nextItems.find((item) => item.id === postId) ?? null;
}

function getActorId(user?: User | null) {
  if (!user) return '';
  return user._id || user.id || user.email;
}

export async function getVolunteerPostsApi() {
  if (useLocalVolunteerApi()) {
    return loadVolunteerPosts().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const { data } = await apiClient.get<{ success: boolean; posts: VolunteerPostItem[] }>('/volunteers');
  return data.posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVolunteerPostByIdApi(id: string) {
  if (useLocalVolunteerApi()) {
    return loadVolunteerPosts().find((item) => item.id === id) ?? null;
  }

  const { data } = await apiClient.get<{ success: boolean; post: VolunteerPostItem }>(`/volunteers/${id}`);
  return data.post;
}

export async function createVolunteerPostApi(
  input: Omit<VolunteerPostItem, 'id' | 'applicants' | 'createdAt'>,
) {
  if (useLocalVolunteerApi()) {
    const items = loadVolunteerPosts();
    const post: VolunteerPostItem = {
      ...input,
      id: crypto.randomUUID(),
      applicants: [],
      createdAt: new Date().toISOString(),
    };
    saveVolunteerPosts([post, ...items]);
    return post;
  }

  const { data } = await apiClient.post<{ success: boolean; post: VolunteerPostItem }>('/volunteers', {
    title: input.title,
    location: input.location,
    sessionTime: input.sessionTime,
    difficulty: input.difficulty,
    notes: input.notes,
  });
  return data.post;
}

export async function applyVolunteerIntentApi(
  postId: string,
  application: Omit<VolunteerApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
) {
  if (useLocalVolunteerApi()) {
    return updateLocalVolunteerPost(postId, (item) => {
      if (item.id !== postId) return item;
      const exists = item.applicants.some((app) => app.userId === application.userId);
      if (exists) return item;
      return {
        ...item,
        applicants: [
          ...item.applicants,
          {
            ...application,
            id: crypto.randomUUID(),
            status: 'interested' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
    });
  }

  const { data } = await apiClient.post<{ success: boolean; post: VolunteerPostItem }>(
    `/volunteers/${postId}/applications`,
    { message: application.message },
  );
  return data.post;
}

export async function updateVolunteerApplicationStatusApi(
  postId: string,
  applicationId: string,
  status: Extract<VolunteerApplication['status'], 'accepted' | 'completed'>,
) {
  if (useLocalVolunteerApi()) {
    return updateLocalVolunteerPost(postId, (item) => ({
      ...item,
      applicants: item.applicants.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              status,
              updatedAt: new Date().toISOString(),
            }
          : application,
      ),
    }));
  }

  const { data } = await apiClient.patch<{ success: boolean; post: VolunteerPostItem }>(
    `/volunteers/${postId}/applications/${applicationId}`,
    { status },
  );
  return data.post;
}

export async function cancelVolunteerApplicationApi(postId: string, applicationId: string) {
  if (useLocalVolunteerApi()) {
    return updateLocalVolunteerPost(postId, (item) => ({
      ...item,
      applicants: item.applicants.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              status: 'cancelled',
              updatedAt: new Date().toISOString(),
            }
          : application,
      ),
    }));
  }

  const { data } = await apiClient.delete<{ success: boolean; post: VolunteerPostItem }>(
    `/volunteers/${postId}/applications/${applicationId}`,
  );
  return data.post;
}

export async function getVolunteerContactIntentsApi(currentUser?: User | null) {
  if (useLocalVolunteerApi()) {
    const items = loadVolunteerPosts();
    const userId = getActorId(currentUser);

    return {
      myRequests: items.filter((item) => item.authorId === userId),
      myApplications: items
        .map((item) => ({
          item,
          application: item.applicants.find((app) => app.userId === userId) ?? null,
        }))
        .filter(
          (
            record,
          ): record is { item: VolunteerPostItem; application: VolunteerApplication } =>
            Boolean(record.application),
        ),
    };
  }

  const { data } = await apiClient.get<{
    success: boolean;
    myRequests: VolunteerPostItem[];
    myApplications: Array<{ item: VolunteerPostItem; application: VolunteerApplication }>;
  }>('/volunteers/contact-intents');

  return {
    myRequests: data.myRequests,
    myApplications: data.myApplications,
  };
}

export async function getMyVolunteerSessionsApi(currentUser?: User | null) {
  if (useLocalVolunteerApi()) {
    const items = loadVolunteerPosts();
    const userId = getActorId(currentUser);
    return items.filter(
      (item) => item.authorId === userId || item.applicants.some((app) => app.userId === userId),
    );
  }

  const { data } = await apiClient.get<{ success: boolean; sessions: VolunteerPostItem[] }>('/volunteers/my-sessions');
  return data.sessions;
}
