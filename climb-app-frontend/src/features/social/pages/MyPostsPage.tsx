import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { getPostsApi } from '../../../shared/api/posts.api';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import type { PostItem } from '../../../shared/types/post';
import PostCard from '../components/PostCard';
import SocialEmptyState from '../components/SocialEmptyState';

export default function MyPostsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [posts, setPosts] = useState<PostItem[]>([]);

  useEffect(() => {
    getPostsApi().then(setPosts);
  }, []);

  const mine = posts.filter((post) => post.authorId === (user?._id || user?.id || user?.email));

  return (
    <section className="stack-lg">
      <div className="page-card stack-sm">
        <h1>{t('My posts')}</h1>
        <p>{t('Review discussions you created and jump back into the community.')}</p>
        <div className="inline-actions wrap">
          <Link to={routes.socialFeed}><Button>{t('Back to feed')}</Button></Link>
          <Link to={routes.createPost}><Button variant="secondary">{t('Create post')}</Button></Link>
        </div>
      </div>

      {mine.length ? (
        <div className="stack-lg">
          {mine.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      ) : (
        <SocialEmptyState
          title={t('No posts yet')}
          body={t('Create your first community post to appear here.')}
          action={<Link className="social-featured-link" to={routes.createPost}>{t('Create post')}</Link>}
          pose="tilt"
        />
      )}
    </section>
  );
}
