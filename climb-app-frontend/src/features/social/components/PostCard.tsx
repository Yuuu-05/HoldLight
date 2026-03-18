import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import type { PostItem } from '../../../shared/types/post';
import { formatDate } from '../../../shared/utils/formatDate';

interface PostCardProps {
  post: PostItem;
}

export default function PostCard({ post }: PostCardProps) {
  const { t } = useLanguage();
  return (
    <Card title={post.title}>
      <p>{post.body}</p>
      <div className="inline-actions wrap">
        {post.tags.map((tag) => (
          <Badge key={tag}>#{tag}</Badge>
        ))}
      </div>
      <p className="subtle-text">
        {t('By')} {post.authorName} - {formatDate(post.createdAt)}
      </p>
      <Link className="text-link" to={`/social/${post.id}`}>
        {t('View discussion')}
      </Link>
    </Card>
  );
}
