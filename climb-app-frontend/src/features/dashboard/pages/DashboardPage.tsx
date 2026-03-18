import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import RoleAwareHome from '../../../shared/components/layout/RoleAwareHome';
import ContinueTutorialCard from '../components/ContinueTutorialCard';
import UpcomingSessionCard from '../components/UpcomingSessionCard';
import ExperiencedHomePage from './ExperiencedHomePage';
import NewUserHomePage from './NewUserHomePage';
import VisuallyImpairedHomePage from './VisuallyImpairedHomePage';
import VolunteerHomePage from './VolunteerHomePage';

export default function DashboardPage() {
  const { user, isOnboarded } = useAuth();
  const { t } = useLanguage();
  usePageTitle('Dashboard');

  const rolePanel = (() => {
    switch (user?.role) {
      case 'visually_impaired':
        return <VisuallyImpairedHomePage />;
      case 'volunteer':
        return <VolunteerHomePage />;
      case 'experienced':
        return <ExperiencedHomePage />;
      default:
        return <NewUserHomePage />;
    }
  })();

  return (
    <div className="dashboard-shell page-illustrated-shell">
      <section className="dashboard-hero">
        <RoleAwareHome />
        <div className="dashboard-glance grid-2">
          <ContinueTutorialCard />
          <UpcomingSessionCard />
        </div>
      </section>
      <Card title={t('Role-based recommendations')} className="role-panel-card">
        {rolePanel}
      </Card>
      {!isOnboarded ? (
        <Card title={t('Complete onboarding')} className="dashboard-onboarding-card">
          <p>{t('Your profile is not complete yet. Fill in key personal and climbing information so the app can personalize guidance.')}</p>
          <Link className="text-link" to={routes.onboarding}>{t('Complete now')}</Link>
        </Card>
      ) : null}
    </div>
  );
}
