import { useLanguage } from '../../../app/providers/LanguageProvider';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import TransitionLink from '../../../shared/components/layout/TransitionLink';
import type { PostItem } from '../../../shared/types/post';
import { formatDate } from '../../../shared/utils/formatDate';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';

interface PostCardProps {
  post: PostItem;
}

export default function PostCard({ post }: PostCardProps) {
  const { t } = useLanguage();
  const authorInitials = post.authorName.slice(0, 2).toUpperCase();

  return (
    <Card
      title={post.title}
      actions={(
        <div className="inline-actions wrap social-post-card-actions">
          <span className="social-mini-pill">
            {post.comments.length} {t(post.comments.length === 1 ? 'comment' : 'comments')}
          </span>
          <span className="social-mini-pill">
            {post.likedBy.length} {t(post.likedBy.length === 1 ? 'like' : 'likes')}
          </span>
        </div>
      )}
      className="community-post-card"
      bodyClassName="community-post-card-body stack-md"
      style={{ viewTransitionName: `post-card-${post.id}` }}
    >
      <div className="community-post-head">
        <div className="community-avatar-badge" aria-hidden="true">
          {authorInitials}
        </div>

        <div className="community-post-meta stack-sm">
          <strong>{post.authorName}</strong>
          <p className="subtle-text">
            {t(getRoleLabel(post.authorRole))} · {formatDate(post.createdAt)}
          </p>
        </div>
      </div>

      <p className="community-post-body">{post.body}</p>

      <div className="inline-actions wrap community-post-tags">
        {post.tags.map((tag) => (
          <Badge key={tag}>#{tag}</Badge>
        ))}
      </div>

      <TransitionLink className="social-inline-link" to={`/social/${post.id}`}>
        {t('View discussion')}
      </TransitionLink>
    </Card>
  );
}
