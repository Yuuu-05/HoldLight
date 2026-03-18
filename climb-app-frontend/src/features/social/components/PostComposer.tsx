import { useState } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import Button from '../../../shared/components/ui/Button';

interface PostComposerProps {
  onSubmit: (input: { title: string; body: string; tags: string[] }) => Promise<void>;
}

export default function PostComposer({ onSubmit }: PostComposerProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const { t } = useLanguage();

  return (
    <div className="stack">
      <Input label={t('Title')} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label={t('Post content')} rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      <Input label={t('Tags')} hint={t('Separate with commas')} value={tags} onChange={(e) => setTags(e.target.value)} />
      <Button onClick={() => onSubmit({ title, body, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) })}>{t('Publish post')}</Button>
    </div>
  );
}
