import { Link } from 'react-router-dom';
import Button from '../shared/components/ui/Button';
import { routes } from '../shared/constants/routes';
import { usePageTitle } from '../shared/hooks/usePageTitle';
import { useLanguage } from '../app/providers/LanguageProvider';

export default function LandingPage() {
  usePageTitle('Welcome');
  const { t } = useLanguage();

  return (
    <div className="landing-shell page-illustrated-shell">
      <section className="hero hero-grid poster-primary-card">
        <div className="hero-main">
          <h1>{t('Accessible climbing guidance for visually impaired climbers.')}</h1>
          <div className="inline-actions wrap">
            <Link to={routes.register}><Button>{t('Create an account')}</Button></Link>
            <Link to={routes.login}><Button variant="secondary">{t('Sign in')}</Button></Link>
          </div>
        </div>

        <div className="hero-rail">
          <div className="hero-module-panel poster-info-card">
            <div className="hero-module-list">
              <div className="hero-module-item">
                <span>{t('Sign in and profile')}</span>
                <span>{t('Step 1')}</span>
              </div>
              <div className="hero-module-item">
                <span>{t('Wall scan and route hints')}</span>
                <span>{t('Step 2')}</span>
              </div>
              <div className="hero-module-item">
                <span>{t('Live guidance and summary')}</span>
                <span>{t('Step 3')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
