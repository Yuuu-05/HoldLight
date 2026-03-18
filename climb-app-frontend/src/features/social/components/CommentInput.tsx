import { useState } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Button from '../../../shared/components/ui/Button';
import Textarea from '../../../shared/components/ui/Textarea';

interface CommentInputProps {
  onSubmit: (body: string) => Promise<void>;
}

export default function CommentInput({ onSubmit }: CommentInputProps) {
  const [body, setBody] = useState('');
  const { t } = useLanguage();
  return (
    <div className="stack">
      <Textarea label={t('Add a comment')} value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
      <Button onClick={async () => { if (!body.trim()) return; await onSubmit(body); setBody(''); }}>{t('Post comment')}</Button>
    </div>
  );
}
