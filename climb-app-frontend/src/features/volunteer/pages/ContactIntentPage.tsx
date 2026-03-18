import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { getVolunteerContactIntentsApi } from '../../../shared/api/volunteers.api';
import EmptyState from '../../../shared/components/feedback/EmptyState';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import type { VolunteerApplication, VolunteerPostItem } from '../../../shared/types/volunteer';
import { formatDate } from '../../../shared/utils/formatDate';

export default function ContactIntentPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [myRequests, setMyRequests] = useState<VolunteerPostItem[]>([]);
  const [myApplications, setMyApplications] = useState<
    Array<{ item: VolunteerPostItem; application: VolunteerApplication }>
  >([]);

  useEffect(() => {
    getVolunteerContactIntentsApi(user).then((result) => {
      setMyRequests(result.myRequests);
      setMyApplications(result.myApplications);
    });
  }, [user]);

  return (
    <section className="stack-lg">
      <div className="page-card stack-lg">
        <div className="stack-sm">
          <h1>{t('Contact intents')}</h1>
          <p>{t('This page shows the lightweight contact mechanism used in the volunteer module. Instead of full chat, users send structured messages attached to support requests.')}</p>
        </div>

        <div className="inline-actions wrap">
          <Link to={routes.volunteerBoard}>
            <Button>{t('Back to volunteer board')}</Button>
          </Link>
          <Link to={routes.volunteerCreate}>
            <Button variant="secondary">{t('Create request')}</Button>
          </Link>
        </div>
      </div>

      <Card title={t('Requests I created')}>
        {myRequests.length ? (
          <div className="stack-md">
            {myRequests.map((item) => (
              <div key={item.id} className="list-item stack-sm">
                <strong>{item.title}</strong>
                <p>
                  {item.location} | {formatDate(item.sessionTime)}
                </p>
                <p>{t('Interested volunteers')}: {item.applicants.length}</p>
                <Link className="text-link" to={`/volunteer/${item.id}`}>
                  {t('View request details')}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('No created requests yet')}
            body={t('Volunteer requests you create will appear here together with incoming contact intents.')}
          />
        )}
      </Card>

      <Card title={t('Requests I expressed interest in')}>
        {myApplications.length ? (
          <div className="stack-md">
            {myApplications.map(({ item, application }) => (
              <div key={application.id} className="list-item stack-sm">
                <strong>{item.title}</strong>
                <p>
                  {item.location} | {formatDate(item.sessionTime)}
                </p>
                <p><strong>{t('Your message:')}</strong> {application.message}</p>
                <p className="subtle-text">
                  {t('Sent on')} {formatDate(application.createdAt)}. {t('Status:')} {t(application.status)}.
                </p>
                <Link className="text-link" to={`/volunteer/${item.id}`}>
                  {t('Open request')}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('No contact intents yet')}
            body={t('When you click \'Express interest\' on a volunteer request, the message will appear here.')}
          />
        )}
      </Card>
    </section>
  );
}
