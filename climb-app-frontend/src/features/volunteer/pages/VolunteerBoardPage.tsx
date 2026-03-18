import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { getVolunteerPostsApi } from '../../../shared/api/volunteers.api';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import type { VolunteerPostItem } from '../../../shared/types/volunteer';
import VolunteerCard from '../components/VolunteerCard';

export default function VolunteerBoardPage() {
  const [items, setItems] = useState<VolunteerPostItem[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    getVolunteerPostsApi().then(setItems);
  }, []);

  return (
    <section className="stack-lg">
      <div className="page-card stack-md">
        <div className="stack-sm">
          <h1>{t('Volunteer board')}</h1>
          <p>{t('Request help, browse upcoming support sessions, and express contact intent with low friction.')}</p>
        </div>

        <div className="inline-actions wrap">
          <Link to={routes.volunteerCreate}><Button>{t('Create request')}</Button></Link>
          <Link to={routes.volunteerMySessions}><Button variant="secondary">{t('My sessions')}</Button></Link>
          <Link to={routes.contactIntent}><Button variant="ghost">{t('Contact intents')}</Button></Link>
        </div>
      </div>

      <div className="stack-lg">
        {items.map((item) => <VolunteerCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}
