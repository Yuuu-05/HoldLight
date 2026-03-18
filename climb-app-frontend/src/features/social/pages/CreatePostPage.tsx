import { useNavigate } from 'react-router-dom';
import { createPostApi } from '../../../shared/api/posts.api';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import PostComposer from '../components/PostComposer';
import Card from '../../../shared/components/ui/Card';

export default function CreatePostPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <Card title={t('Create community post')}>
      <PostComposer
        onSubmit={async ({ title, body, tags }) => {
          const post = await createPostApi({
            title,
            body,
            tags,
            authorId: user._id || user.id || user.email,
            authorName: user.username,
            authorRole: user.role,
          });
          navigate(`/social/${post.id}`);
        }}
      />
    </Card>
  );
}
