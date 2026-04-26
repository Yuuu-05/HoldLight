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
  const { t } = useLanguage();
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
        <strong>{t(getRoleLabel(user?.role))}</strong>
      </Card>

      {isDevAuthBypassAvailable ? (
        <Card title={t('Development role switch')}>
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
