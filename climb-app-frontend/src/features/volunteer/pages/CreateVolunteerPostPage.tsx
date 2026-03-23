import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createVolunteerPostApi } from '../../../shared/api/volunteers.api';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import { routes } from '../../../shared/constants/routes';

export default function CreateVolunteerPostPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [notes, setNotes] = useState('');
  const isHighDifficulty = useMemo(
    () => /(advanced|expert|hard|high|v[4-9]|5\.\d+)/i.test(difficulty),
    [difficulty],
  );

  if (!user) return null;

  return (
    <section className="social-shell stack-lg">
      <div className="social-detail-hero social-detail-hero-volunteer">
        <div className="stack-md">
          <div className="stack-sm">
            <p className="social-eyebrow">Volunteer request</p>
            <h1>{t('Create volunteer request')}</h1>
            <p>Shape the request in a calm, structured way so a volunteer can understand the route, time, and support style at a glance.</p>
          </div>
          <div className="inline-actions wrap">
            <Link className="social-inline-link" to={routes.volunteerBoard}>{t('Back to volunteer board')}</Link>
          </div>
        </div>
      </div>

      <Card title={t('Create volunteer request')} className="volunteer-form-card">
        <div className={`volunteer-form-banner ${isHighDifficulty ? 'is-strong' : ''}`.trim()}>
          <GuideMascot className="volunteer-form-mascot" pose={isHighDifficulty ? 'celebrate' : 'nod'} />
          <div className="stack-sm">
            <strong>{isHighDifficulty ? 'High-focus route selected' : 'Gentle support request'}</strong>
            <p className="subtle-text">
              {isHighDifficulty
                ? 'Monkey put on the headband. A little extra detail here will help the volunteer feel prepared.'
                : 'Keep the request warm and clear. A short note about the route and support style is enough.'}
            </p>
          </div>
        </div>

        <div className="stack">
          <Input label={t('Title')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label={t('Location')} value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input label={t('Session time')} type="datetime-local" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} />
          <Input label={t('Difficulty')} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
          <Textarea label={t('Notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
          <Button onClick={async () => {
            const post = await createVolunteerPostApi({
              title,
              location,
              sessionTime: new Date(sessionTime).toISOString(),
              difficulty,
              notes,
              authorId: user._id || user.id || user.email,
              authorName: user.username,
            });
            navigate(routes.volunteerPostDetail(post.id));
          }}>{t('Publish request')}</Button>
        </div>
      </Card>
    </section>
  );
}
