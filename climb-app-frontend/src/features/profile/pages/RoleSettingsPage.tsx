import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { roleOptions } from '../../../shared/constants/roles';
import { routes } from '../../../shared/constants/routes';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';

export default function RoleSettingsPage() {
  usePageTitle('Role settings');
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const {
    user,
    isUsingDevAuth,
    isDevAuthBypassAvailable,
    loginAsDevUser,
  } = useAuth();

  return (
    <section className="stack-lg">
      <Card title={t('Current role')}>
        <p>
          {language === 'zh'
            ? `${t('Your account is currently set to')} `
            : `${t('Your account is currently set to')} `}
          <strong>{t(getRoleLabel(user?.role))}</strong>.
        </p>
        <p>{t('The interface adapts based on this role, including dashboard guidance, tutorial emphasis, volunteer flows, and accessibility shortcuts.')}</p>
      </Card>

      <Card title={t('Role guide')}>
        <ul className="clean-list">
          <li><strong>{t('New climber')}</strong>: {t('focuses on tutorial content and lower-stress guidance.')}</li>
          <li><strong>{t('Experienced climber')}</strong>: {t('focuses more on community participation and advanced demos.')}</li>
          <li><strong>{t('Visually impaired climber')}</strong>: {t('prioritises voice-first and accessibility support.')}</li>
          <li><strong>{t('Volunteer guide')}</strong>: {t('prioritises support requests and structured contact intent.')}</li>
        </ul>
      </Card>

      {isDevAuthBypassAvailable ? (
        <Card title={t('Development role switch')}>
          <p>{t('In development mode you can switch the active demo role instantly to preview different dashboard and navigation states.')}</p>
          <div className="stack-sm">
            {roleOptions.map((role) => (
              <Button
                key={role.value}
                variant={user?.role === role.value ? 'primary' : 'secondary'}
                onClick={() => void loginAsDevUser(role.value)}
                disabled={!isUsingDevAuth && user?.role === role.value}
              >
                {t('View as')} {t(role.label)}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="inline-actions wrap">
        <Button onClick={() => navigate(routes.dashboard)}>{t('Back to dashboard')}</Button>
        <Button variant="ghost" onClick={() => navigate(routes.profile)}>
          {t('Back to profile')}
        </Button>
      </div>
    </section>
  );
}
