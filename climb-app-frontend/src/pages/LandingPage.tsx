import { Link } from 'react-router-dom';
import Card from '../shared/components/ui/Card';
import Button from '../shared/components/ui/Button';
import { routes } from '../shared/constants/routes';
import { usePageTitle } from '../shared/hooks/usePageTitle';
import { useLanguage } from '../app/providers/LanguageProvider';
import MascotGuidePanel from '../shared/components/illustration/MascotGuidePanel';

export default function LandingPage() {
  usePageTitle('Welcome');
  const { t } = useLanguage();
  const landingMascotTips = [
    { pose: 'tilt' as const, message: t('Start with a clear wall scan before your session begins.') },
    { pose: 'nod' as const, message: t('When you are ready, open assist to scan holds and route hints.') },
    { pose: 'celebrate' as const, message: t('Use route guidance and climb summaries to keep each session organized.') },
  ];

  return (
    <div className="landing-shell page-illustrated-shell">
      <section className="hero hero-grid poster-primary-card">
        <div className="hero-main">
          <span className="eyebrow">{t('CPT208 human-centered climbing app')}</span>
          <h1>{t('Accessible climbing guidance for visually impaired climbers.')}</h1>
          <p className="hero-copy">
            {t('This frontend focuses on voice-first interaction, wall scanning, route guidance, and climb review for visually impaired climbers.')}
          </p>
          <MascotGuidePanel
            title={t('Guide mascot')}
            tips={landingMascotTips}
            className="sticker-card mascot-guide-panel-feature"
          />
          <div className="inline-actions wrap">
            <Link to={routes.register}><Button>{t('Create an account')}</Button></Link>
            <Link to={routes.login}><Button variant="secondary">{t('Sign in')}</Button></Link>
          </div>
        </div>

        <div className="hero-rail">
          <div className="hero-note poster-note-card">
            <h2 className="card-title">{t('Voice-first guidance')}</h2>
            <p>{t('Use read-aloud controls, clear prompts, and route hints for a lower-stress experience.')}</p>
          </div>
          <div className="hero-module-panel poster-info-card">
            <strong>{t('Focused climbing flow')}</strong>
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

      <section className="grid-3 feature-strip">
        <Card title={t('Voice-first guidance')} className="feature-strip-card">
          <p>{t('Use read-aloud controls, clear prompts, and route hints for a lower-stress experience.')}</p>
        </Card>
        <Card title={t('Wall scan workflow')} className="feature-strip-card">
          <p>{t('Prepare a route with guided scanning, route recommendations, and live positioning cues.')}</p>
        </Card>
        <Card title={t('Climb review')} className="feature-strip-card">
          <p>{t('Review guidance results, route choices, and key climb details after each session.')}</p>
        </Card>
      </section>
    </div>
  );
}
