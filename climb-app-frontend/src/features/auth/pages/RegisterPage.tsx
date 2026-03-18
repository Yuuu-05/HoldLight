import { Link } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function RegisterPage() {
  usePageTitle('Register');
  const { t } = useLanguage();
  return (
    <section className="auth-shell">
      <div className="page-card">
        <h1>{t('Create account')}</h1>
        <p>{t('Choose your role first, then complete the detailed onboarding profile after sign-up.')}</p>
        <RegisterForm />
        <p>
          {t('Already have an account?')} <Link className="text-link" to={routes.login}>{t('Go to login')}</Link>
        </p>
      </div>
    </section>
  );
}
