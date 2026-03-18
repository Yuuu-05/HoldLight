import { apiClient } from './client';
import { readStorage, storageKeys, writeStorage } from '../lib/storage';
import type { PostComment, PostItem } from '../types/post';

const DEV_TOKEN_PREFIX = 'dev-auth-token:';

const seedPosts: PostItem[] = [
  {
    id: 'post-1',
    title: 'My first accessible climbing session',
    body: 'Tried the voice-guided route prototype today. Clear audio cues made the wall feel much less intimidating.',
    tags: ['accessible', 'beginner'],
    authorId: 'seed-user-1',
    authorName: 'Li Wen',
    authorRole: 'visually_impaired',
    likedBy: [],
    comments: [
      {
        id: 'comment-1',
        authorId: 'seed-user-2',
        authorName: 'Daniel Chen',
        body: 'So glad it helped. The volunteer preview card was useful for me too.',
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

function loadPosts() {
  const stored = readStorage<PostItem[]>(storageKeys.posts, []);
  if (stored.length) return stored;
  writeStorage(storageKeys.posts, seedPosts);
  return seedPosts;
}

function savePosts(posts: PostItem[]) {
  writeStorage(storageKeys.posts, posts);
  return posts;
}

function useLocalPostApi() {
  const token = readStorage<string | null>(storageKeys.token, null);
  return Boolean(token?.startsWith(DEV_TOKEN_PREFIX));
}

function createLocalPost(input: Omit<PostItem, 'id' | 'likedBy' | 'comments' | 'createdAt'>) {
  const posts = loadPosts();
  const post: PostItem = {
    ...input,
    id: crypto.randomUUID(),
    likedBy: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
  savePosts([post, ...posts]);
  return post;
}

function toggleLocalLike(postId: string, userId: string) {
  const posts = loadPosts();
  const updated = posts.map((post) => {
    if (post.id !== postId) return post;
    const liked = post.likedBy.includes(userId)
      ? post.likedBy.filter((id) => id !== userId)
      : [...post.likedBy, userId];
    return { ...post, likedBy: liked };
  });
  savePosts(updated);
  return updated.find((post) => post.id === postId) ?? null;
}

function addLocalComment(postId: string, comment: Omit<PostComment, 'id' | 'createdAt'>) {
  const posts = loadPosts();
  const updated = posts.map((post) => {
    if (post.id !== postId) return post;
    return {
      ...post,
      comments: [
        ...post.comments,
        { ...comment, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ],
    };
  });
  savePosts(updated);
  return updated.find((post) => post.id === postId) ?? null;
}

export async function getPostsApi() {
  if (useLocalPostApi()) {
    return loadPosts().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  try {
    const { data } = await apiClient.get<{ success: boolean; posts: PostItem[] }>('/posts');
    return data.posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return loadPosts().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function getPostByIdApi(id: string) {
  if (useLocalPostApi()) {
    return loadPosts().find((post) => post.id === id) ?? null;
  }

  try {
    const { data } = await apiClient.get<{ success: boolean; post: PostItem }>(`/posts/${id}`);
    return data.post;
  } catch (err) {
    const local = loadPosts().find((post) => post.id === id) ?? null;
    if (local) return local;
    if (err instanceof Error && err.message === 'Post not found') return null;
    return null;
  }
}

export async function createPostApi(input: Omit<PostItem, 'id' | 'likedBy' | 'comments' | 'createdAt'>) {
  if (useLocalPostApi()) {
    return createLocalPost(input);
  }

  const { data } = await apiClient.post<{ success: boolean; post: PostItem }>('/posts', {
    title: input.title,
    body: input.body,
    tags: input.tags,
  });
  return data.post;
}

export async function toggleLikePostApi(postId: string, userId: string) {
  if (useLocalPostApi()) {
    return toggleLocalLike(postId, userId);
  }

  const { data } = await apiClient.post<{ success: boolean; post: PostItem }>(`/posts/${postId}/like`);
  return data.post;
}

export async function addCommentApi(postId: string, comment: Omit<PostComment, 'id' | 'createdAt'>) {
  if (useLocalPostApi()) {
    return addLocalComment(postId, comment);
  }

  const { data } = await apiClient.post<{ success: boolean; post: PostItem }>(`/posts/${postId}/comments`, {
    body: comment.body,
  });
  return data.post;
}
