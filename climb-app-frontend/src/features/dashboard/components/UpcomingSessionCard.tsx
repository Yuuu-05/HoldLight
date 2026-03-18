import { Link } from 'react-router-dom';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { formatDate } from '../../../shared/utils/formatDate';
import { useVolunteerBoard } from '../../volunteer/hooks/useVolunteerBoard';

export default function UpcomingSessionCard() {
  const { upcomingSessions } = useVolunteerBoard();
  const nextSession = upcomingSessions[0];
  const { t } = useLanguage();

  return (
    <Card title={t('Upcoming session')} className="session-card">
      {nextSession ? (
        <>
          <p><strong>{nextSession.title}</strong></p>
          <p>{nextSession.location}</p>
          <p className="subtle-text">{formatDate(nextSession.sessionTime)}</p>
          <Link to={routes.volunteerMySessions}>
            <Button fullWidth variant="secondary">{t('Open my sessions')}</Button>
          </Link>
        </>
      ) : (
        <>
          <p>{t('No upcoming volunteer or support sessions are attached to your account yet.')}</p>
          <Link to={routes.scanWall}>
            <Button fullWidth variant="secondary">{t('Find support')}</Button>
          </Link>
        </>
      )}
    </Card>
  );
}
