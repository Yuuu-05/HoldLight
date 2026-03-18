import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { getPostsApi } from '../../../shared/api/posts.api';
import type { PostItem } from '../../../shared/types/post';

export function useFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextPosts = await getPostsApi();
      setPosts(nextPosts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const userId = user?._id || user?.id || user?.email || '';

  const summary = useMemo(
    () => ({
      posts,
      loading,
      refresh,
      myPosts: posts.filter((post) => post.authorId === userId),
      postsWithActivity: posts.filter((post) => post.authorId === userId && post.comments.length > 0),
    }),
    [loading, posts, refresh, userId],
  );

  return summary;
}
