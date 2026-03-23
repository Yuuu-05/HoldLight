import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { getMyVolunteerSessionsApi } from '../../../shared/api/volunteers.api';
import EmptyState from '../../../shared/components/feedback/EmptyState';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import type { VolunteerPostItem } from '../../../shared/types/volunteer';
import VolunteerCard from '../components/VolunteerCard';

export default function MyVolunteerSessionsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<VolunteerPostItem[]>([]);

  useEffect(() => {
    getMyVolunteerSessionsApi(user).then(setItems);
  }, [user]);

  return (
    <section className="stack-lg">
      <div className="page-card stack-sm">
        <h1>{t('My volunteer sessions')}</h1>
        <p>{t('Review requests you created and support sessions where you already expressed interest.')}</p>
        <div className="inline-actions wrap">
          <Link to={routes.socialFeed}><Button variant="ghost">{t('Back to community')}</Button></Link>
          <Link to={routes.volunteerBoard}><Button>{t('Volunteer board')}</Button></Link>
          <Link to={routes.contactIntent}><Button variant="secondary">{t('View all contact intents')}</Button></Link>
        </div>
      </div>

      {items.length ? (
        <div className="community-request-grid">
          {items.map((item) => <VolunteerCard key={item.id} item={item} />)}
        </div>
      ) : (
        <EmptyState
          title={t('No sessions yet')}
          body={t('Your created requests or volunteer interests will appear here.')}
        />
      )}
    </section>
  );
}
