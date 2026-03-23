import { Link } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function RegisterPage() {
  usePageTitle('Register');
  const { language, t } = useLanguage();

  return (
    <section className="auth-shell">
      <div className="page-card">
        <h1>{t('Create account')}</h1>
        <p>
          {language === 'zh'
            ? '先选择你的角色。注册后，视障用户会先进入视障模式调试页，然后所有用户都会进入同一个简洁引导。'
            : 'Choose your role first. After sign-up, visually impaired climbers tune vision mode first, then everyone enters the same short guide.'}
        </p>
        <RegisterForm />
        <p>
          {t('Already have an account?')} <Link className="text-link" to={routes.login}>{t('Go to login')}</Link>
        </p>
      </div>
    </section>
  );
}
