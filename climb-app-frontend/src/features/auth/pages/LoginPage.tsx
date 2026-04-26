import { Link } from 'react-router-dom';
import { env } from '../../../app/config/env';
import { useAuth } from '../../../app/providers/AuthProvider';
import { roleOptions } from '../../../shared/constants/roles';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import Button from '../../../shared/components/ui/Button';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
  usePageTitle('Login');
  const { isDevAuthBypassAvailable, loginAsDevUser } = useAuth();
  const { t } = useLanguage();
  const showDevShortcut = env.isDev && isDevAuthBypassAvailable;

  return (
    <section className="auth-shell">
      <div className="page-card stack-md">
        <div className="stack-sm">
          <h1>{t('Login')}</h1>
        </div>

        {showDevShortcut ? (
          <div className="page-card stack-sm">
            <h2>{t('Development shortcut')}</h2>
            <div className="stack-sm">
              {roleOptions.map((role) => (
                <Button
                  key={role.value}
                  variant="secondary"
                  onClick={() => void loginAsDevUser(role.value)}
                >
                  {t('Continue as')} {t(role.label)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <LoginForm />

        <p>
          {t('No account yet?')} <Link className="text-link" to={routes.register}>{t('Register here')}</Link>
        </p>
      </div>
    </section>
  );
}
