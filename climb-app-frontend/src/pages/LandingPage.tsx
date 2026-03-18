import { Link } from 'react-router-dom';
import Card from '../shared/components/ui/Card';
import Button from '../shared/components/ui/Button';
import { routes } from '../shared/constants/routes';
import { tutorialModules } from '../shared/constants/tutorial';
import { usePageTitle } from '../shared/hooks/usePageTitle';
import { useLanguage } from '../app/providers/LanguageProvider';
import MascotGuidePanel from '../shared/components/illustration/MascotGuidePanel';

export default function LandingPage() {
  usePageTitle('Welcome');
  const { t } = useLanguage();
  const landingMascotTips = [
    { pose: 'tilt' as const, message: t('Start with the tutorial path first.') },
    { pose: 'nod' as const, message: t('When you are ready, open assist to scan holds and route hints.') },
    { pose: 'celebrate' as const, message: t('You can always switch on accessibility support later.') },
  ];

  return (
    <div className="landing-shell page-illustrated-shell">
      <section className="hero hero-grid poster-primary-card">
        <div className="hero-main">
          <span className="eyebrow">{t('CPT208 human-centered climbing app')}</span>
          <h1>{t('Accessible climbing, beginner education, and volunteer coordination in one place.')}</h1>
          <p className="hero-copy">
            {t('This frontend combines user onboarding, accessible interaction, tutorial content, real-time route guidance prototype, and lightweight community tools so the final Render deployment feels like a coherent product instead of separate coursework pages.')}
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
            <p>{t('Use read-aloud controls, high-contrast mode, large touch targets, and optional voice commands for a lower-stress experience.')}</p>
          </div>
          <div className="hero-module-panel poster-info-card">
            <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
              <strong>{t('Beginner tutorial modules')}</strong>
              <span className="badge">{tutorialModules.length}</span>
            </div>
            <div className="hero-module-list">
              {tutorialModules.map((module) => (
                <div key={module.id} className="hero-module-item">
                  <span>{t(module.title)}</span>
                  <span>~{module.estimatedMinutes}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid-3 feature-strip">
        <Card title={t('Voice-first guidance')} className="feature-strip-card">
          <p>{t('Use read-aloud controls, high-contrast mode, large touch targets, and optional voice commands for a lower-stress experience.')}</p>
        </Card>
        <Card title={t('Beginner tutorial hub')} className="feature-strip-card">
          <p>{t('Teach rules, gear, terms, and safety tips with simple language and progress tracking.')}</p>
        </Card>
        <Card title={t('Volunteer support flow')} className="feature-strip-card">
          <p>{t('Post support requests, browse volunteer opportunities, and prepare for sessions with route previews.')}</p>
        </Card>
      </section>

      <section className="stack-md landing-module-section">
        <h2>{t('Beginner tutorial modules')}</h2>
        <div className="grid-2 module-grid poster-grid">
          {tutorialModules.map((module, index) => (
            <Card
              key={module.id}
              title={t(module.title)}
              className={`module-card-paper ${index % 2 === 0 ? 'module-card-accent' : ''}`.trim()}
            >
              <p>{t(module.description)}</p>
              <ul className="clean-list">
                {module.points.map((point) => <li key={point}>{t(point)}</li>)}
              </ul>
              <Link className="text-link" to={module.route}>{t('Open module')}</Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
