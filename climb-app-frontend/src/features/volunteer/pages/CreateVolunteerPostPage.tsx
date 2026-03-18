import { useNavigate } from 'react-router-dom';
import { createVolunteerPostApi } from '../../../shared/api/volunteers.api';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { useState } from 'react';

export default function CreateVolunteerPostPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [notes, setNotes] = useState('');

  if (!user) return null;

  return (
    <Card title={t('Create volunteer request')}>
      <div className="stack">
        <Input label={t('Title')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label={t('Location')} value={location} onChange={(e) => setLocation(e.target.value)} />
        <Input label={t('Session time')} type="datetime-local" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} />
        <Input label={t('Difficulty')} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
        <Textarea label={t('Notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
        <Button onClick={async () => {
          const post = await createVolunteerPostApi({
            title, location, sessionTime: new Date(sessionTime).toISOString(), difficulty, notes,
            authorId: user._id || user.id || user.email, authorName: user.username,
          });
          navigate(`/volunteer/${post.id}`);
        }}>{t('Publish request')}</Button>
      </div>
    </Card>
  );
}
