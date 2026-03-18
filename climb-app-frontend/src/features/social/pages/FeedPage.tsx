import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import EmptyState from '../../../shared/components/feedback/EmptyState';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import PostCard from '../components/PostCard';
import { useFeed } from '../hooks/useFeed';

export default function FeedPage() {
  const { posts } = useFeed();
  const [search, setSearch] = useState('');
  const { t } = useLanguage();
  usePageTitle('Community feed');

  const filtered = useMemo(
    () =>
      posts.filter((post) =>
        `${post.title} ${post.body} ${post.tags.join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [posts, search],
  );

  return (
    <section className="stack-lg">
      <div className="page-card stack-md">
        <div className="stack-sm">
          <h1>{t('Community feed')}</h1>
          <p>
            {t('This social area now includes public posts, comments, likes, friend relationships, and gym-based climbing rooms.')}
          </p>
        </div>
        <div className="inline-actions wrap">
          <input className="search-input" placeholder={t('Search posts')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Link to={routes.createPost}><Button>{t('Create post')}</Button></Link>
          <Link to={routes.myPosts}><Button variant="secondary">{t('My posts')}</Button></Link>
          <Link to={routes.socialFriends}><Button variant="secondary">{t('Friends')}</Button></Link>
          <Link to={routes.socialRooms}><Button variant="ghost">{t('Climbing rooms')}</Button></Link>
        </div>
      </div>
      {filtered.length ? filtered.map((post) => <PostCard key={post.id} post={post} />) : <EmptyState title={t('No posts found')} body={t('Try another keyword or create the first post.')} />}
    </section>
  );
}
