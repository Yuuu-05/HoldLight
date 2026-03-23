import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { addCommentApi, getPostByIdApi, toggleLikePostApi } from '../../../shared/api/posts.api';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import SuccessBanner from '../../../shared/components/feedback/SuccessBanner';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import type { PostItem } from '../../../shared/types/post';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import { formatDate } from '../../../shared/utils/formatDate';
import CommentInput from '../components/CommentInput';
import CommentList from '../components/CommentList';
import LikeButton from '../components/LikeButton';
import TransitionLink from '../../../shared/components/layout/TransitionLink';
import SocialEmptyState from '../components/SocialEmptyState';

export default function PostDetailPage() {
  const { postId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [post, setPost] = useState<PostItem | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!postId) return;
    getPostByIdApi(postId).then(setPost);
  }, [postId]);

  if (!post) {
    return (
      <SocialEmptyState
        title={t('Discussion')}
        body={t('Post not found.')}
        action={<TransitionLink className="social-featured-link" to={routes.socialFeed}>{t('Back to feed')}</TransitionLink>}
        pose="tilt"
      />
    );
  }

  const currentPost = post;
  const userId = user?._id || user?.id || user?.email || '';
  const liked = userId ? currentPost.likedBy.includes(userId) : false;

  async function handleToggleLike() {
    setError('');
    setFeedback('');

    if (!userId) {
      setError(t('You need to be signed in to like this post.'));
      return;
    }

    const updated = await toggleLikePostApi(currentPost.id, userId);
    if (updated) {
      setPost(updated);
      setFeedback(liked ? t('Like removed.') : t('Post liked.'));
    }
  }

  async function handleCommentSubmit(body: string) {
    setError('');
    setFeedback('');

    const updated = await addCommentApi(currentPost.id, {
      authorId: userId,
      authorName: user?.username ?? t('Member'),
      body,
    });

    if (updated) {
      setPost(updated);
      setFeedback(t('Comment posted successfully.'));
    }
  }

  return (
    <section className="stack-lg">
      <div
        className="page-card stack-md community-detail-hero"
        style={{ viewTransitionName: `post-card-${currentPost.id}` }}
      >
        <div className="stack-sm">
          <p className="subtle-text">{t('Community discussion')}</p>
          <h1>{currentPost.title}</h1>
          <p>{currentPost.body}</p>
        </div>

        <div className="inline-actions wrap">
          {currentPost.tags.map((tag) => (
            <Badge key={tag}>#{tag}</Badge>
          ))}
        </div>

        <div className="page-card stack-sm">
          <p><strong>{t('Author:')}</strong> {currentPost.authorName}</p>
          <p><strong>{t('Role')}:</strong> {t(getRoleLabel(currentPost.authorRole))}</p>
          <p><strong>{t('Posted:')}</strong> {formatDate(currentPost.createdAt)}</p>
          <p><strong>{t('Likes:')}</strong> {currentPost.likedBy.length}</p>
          <p><strong>{t('Comments:')}</strong> {currentPost.comments.length}</p>
        </div>

        <div className="inline-actions wrap">
          <LikeButton count={currentPost.likedBy.length} active={liked} onClick={handleToggleLike} />
          <TransitionLink to={routes.socialFeed}>
            <Button variant="ghost">{t('Back to feed')}</Button>
          </TransitionLink>
        </div>

        {feedback ? <SuccessBanner message={feedback} /> : null}
        {error ? <ErrorState message={error} /> : null}
      </div>

      <Card title={t('Comments')}>
        <CommentList comments={currentPost.comments} />
      </Card>

      {user ? (
        <Card title={t('Add a comment')}>
          <CommentInput onSubmit={handleCommentSubmit} />
        </Card>
      ) : (
        <Card title={t('Comment access')}>
          <p>{t('You need to be signed in to add comments to this discussion.')}</p>
        </Card>
      )}
    </section>
  );
}
