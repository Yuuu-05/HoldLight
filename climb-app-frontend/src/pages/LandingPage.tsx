import { useEffect, useRef, type CSSProperties } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../app/providers/AuthProvider';
import { useLanguage } from '../app/providers/LanguageProvider';
import AppBrand from '../shared/components/brand/AppBrand';
import LanguageSwitcher from '../shared/components/layout/LanguageSwitcher';
import { routes } from '../shared/constants/routes';
import { usePageTitle } from '../shared/hooks/usePageTitle';

type LandingVisualStyle = CSSProperties & Record<string, string | number>;

// Tune hero feature layout here: sizes use rem, positions use %, vw, or calc().
const LANDING_HERO_PARAMS = {
  heroInfoTop: 'calc(3.82rem + env(safe-area-inset-top))',
  heroInfoRight: 'calc(var(--landing-side-pad) + 0.52rem)',
  heroInfoWidth: 'min(63vw, 17.35rem)',
  heroInfoMaxHeight: '54svh',
  heroInfoGap: '0.32rem',
  compactHeroInfoTop: 'calc(3.56rem + env(safe-area-inset-top))',
  compactHeroInfoWidth: 'min(64vw, 14rem)',
  compactHeroInfoGap: '0.28rem',
};

const LANDING_FEATURE_PARAMS = {
  panelGap: '0.28rem',
  mapWidth: 'min(100%, 16rem)',
  mapHeight: '12.6rem',
  nodeDefaultSize: '2.82rem',
  nodeCoreSize: '3.72rem',
  nodePrimarySize: '2.88rem',
  nodeSecondarySize: '2.12rem',
  labelFontSize: '0.6rem',
  coreLabelFontSize: '0.76rem',
  secondaryLabelFontSize: '0.5rem',
  compactMapHeight: '10.16rem',
  compactNodeCoreSize: '3.04rem',
  compactNodePrimarySize: '2.38rem',
  compactNodeSecondarySize: '1.76rem',
  compactLabelFontSize: '0.49rem',
  nodes: {
    guide: { x: '50%', y: '56%', size: 'var(--landing-feature-core-size)' },
    scan: { x: '22%', y: '42%', size: 'var(--landing-feature-primary-size)' },
    review: { x: '78%', y: '40%', size: 'var(--landing-feature-primary-size)' },
    voice: { x: '58%', y: '24%', size: 'var(--landing-feature-primary-size)' },
    safety: { x: '28%', y: '77%', size: 'var(--landing-feature-primary-size)' },
    preview: { x: '72%', y: '78%', size: 'var(--landing-feature-primary-size)' },
    setup: { x: '14%', y: '16%', size: 'var(--landing-feature-secondary-size)' },
    access: { x: '46%', y: '8%', size: 'var(--landing-feature-secondary-size)' },
    focus: { x: '91%', y: '56%', size: 'var(--landing-feature-secondary-size)' },
    repeat: { x: '16%', y: '92%', size: 'var(--landing-feature-secondary-size)' },
  },
};

const LANDING_HERO_INFO_STYLE = {
  '--landing-hero-info-top': LANDING_HERO_PARAMS.heroInfoTop,
  '--landing-hero-info-right': LANDING_HERO_PARAMS.heroInfoRight,
  '--landing-hero-info-width': LANDING_HERO_PARAMS.heroInfoWidth,
  '--landing-hero-info-max-height': LANDING_HERO_PARAMS.heroInfoMaxHeight,
  '--landing-hero-info-gap': LANDING_HERO_PARAMS.heroInfoGap,
  '--landing-hero-info-compact-top': LANDING_HERO_PARAMS.compactHeroInfoTop,
  '--landing-hero-info-compact-width': LANDING_HERO_PARAMS.compactHeroInfoWidth,
  '--landing-hero-info-compact-gap': LANDING_HERO_PARAMS.compactHeroInfoGap,
  '--landing-feature-panel-gap': LANDING_FEATURE_PARAMS.panelGap,
  '--landing-feature-map-width': LANDING_FEATURE_PARAMS.mapWidth,
  '--landing-feature-map-height': LANDING_FEATURE_PARAMS.mapHeight,
  '--landing-feature-default-size': LANDING_FEATURE_PARAMS.nodeDefaultSize,
  '--landing-feature-core-size': LANDING_FEATURE_PARAMS.nodeCoreSize,
  '--landing-feature-primary-size': LANDING_FEATURE_PARAMS.nodePrimarySize,
  '--landing-feature-secondary-size': LANDING_FEATURE_PARAMS.nodeSecondarySize,
  '--landing-feature-label-font-size': LANDING_FEATURE_PARAMS.labelFontSize,
  '--landing-feature-core-label-font-size': LANDING_FEATURE_PARAMS.coreLabelFontSize,
  '--landing-feature-secondary-label-font-size': LANDING_FEATURE_PARAMS.secondaryLabelFontSize,
  '--landing-feature-compact-map-height': LANDING_FEATURE_PARAMS.compactMapHeight,
  '--landing-feature-compact-core-size': LANDING_FEATURE_PARAMS.compactNodeCoreSize,
  '--landing-feature-compact-primary-size': LANDING_FEATURE_PARAMS.compactNodePrimarySize,
  '--landing-feature-compact-secondary-size': LANDING_FEATURE_PARAMS.compactNodeSecondarySize,
  '--landing-feature-compact-label-font-size': LANDING_FEATURE_PARAMS.compactLabelFontSize,
} as LandingVisualStyle;

export default function LandingPage() {
  usePageTitle('Welcome');
  const { isAuthenticated, loading } = useAuth();
  const { language, t } = useLanguage();
  const landingShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = landingShellRef.current;
    const revealItems = Array.from(root?.querySelectorAll<HTMLElement>('.landing-scroll-reveal') ?? []);

    if (!revealItems.length) return undefined;

    if (!('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            target.classList.add('is-visible');
            return;
          }

          target.classList.remove('is-visible');
        });
      },
      { root, rootMargin: '-5% 0px -8% 0px', threshold: 0.18 },
    );

    revealItems.forEach((item) => item.classList.remove('is-visible'));
    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [language]);

  if (loading) {
    return (
      <div className="landing-shell frosted-grain-surface">
        <div className="landing-hero">
          <p>{t('Loading account...')}</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={routes.dashboard} replace />;
  }

  const copy = {
    eyebrow: t('Climbing guidance'),
    titleLines: [
      `${t('Hear the route.')} ${t('Move with calm.')}`,
      t('Everyone can hold the light'),
    ],
    primary: t('Start'),
    secondary: t('Sign in'),
  };

  const features = [
    {
      className: 'landing-feature-guide',
      title: t('Guide'),
      tier: 'core',
      visual: LANDING_FEATURE_PARAMS.nodes.guide,
    },
    {
      className: 'landing-feature-scan',
      title: t('Scan'),
      tier: 'primary',
      visual: LANDING_FEATURE_PARAMS.nodes.scan,
    },
    {
      className: 'landing-feature-review',
      title: t('Review'),
      tier: 'primary',
      visual: LANDING_FEATURE_PARAMS.nodes.review,
    },
    {
      className: 'landing-feature-voice',
      title: t('Voice'),
      tier: 'primary',
      visual: LANDING_FEATURE_PARAMS.nodes.voice,
    },
    {
      className: 'landing-feature-safety',
      title: t('Safety'),
      tier: 'primary',
      visual: LANDING_FEATURE_PARAMS.nodes.safety,
    },
    {
      className: 'landing-feature-preview',
      title: t('Preview'),
      tier: 'primary',
      visual: LANDING_FEATURE_PARAMS.nodes.preview,
    },
    {
      className: 'landing-feature-setup',
      title: t('Setup'),
      tier: 'secondary',
      visual: LANDING_FEATURE_PARAMS.nodes.setup,
    },
    {
      className: 'landing-feature-access',
      title: t('Access'),
      tier: 'secondary',
      visual: LANDING_FEATURE_PARAMS.nodes.access,
    },
    {
      className: 'landing-feature-focus',
      title: t('Focus'),
      tier: 'secondary',
      visual: LANDING_FEATURE_PARAMS.nodes.focus,
    },
    {
      className: 'landing-feature-repeat',
      title: t('Repeat'),
      tier: 'secondary',
      visual: LANDING_FEATURE_PARAMS.nodes.repeat,
    },
  ];

  return (
    <div
      ref={landingShellRef}
      className="landing-shell frosted-grain-surface onboarding-landing"
      data-language={language}
    >
      <div className="landing-language-switch">
        <LanguageSwitcher />
      </div>

      <section className="landing-screen landing-hero-screen landing-scroll-reveal" aria-labelledby="landing-hero-title">
        <div className="landing-cover-copy">
          <AppBrand size="lg" label={t('HoldLight')} decorative />
          <span className="landing-cover-kicker">{copy.eyebrow}</span>
          <h1 id="landing-hero-title">
            {copy.titleLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
        </div>

        <div className="landing-hero-info" aria-label={t('Core capabilities')} style={LANDING_HERO_INFO_STYLE}>
          <div className="landing-feature-panel">
            <div className="landing-feature-map" aria-label={t('Core capabilities')}>
              <svg className="landing-feature-path" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <path className="landing-feature-track landing-feature-track-outer" d="M13 42 C8 24 23 12 41 18 C59 24 59 7 69 13 C81 21 74 36 85 47 C95 58 86 76 72 84 C55 95 43 83 31 89 C18 95 10 78 18 66 C26 54 18 50 13 42Z" />
                <path className="landing-feature-track landing-feature-track-inner" d="M19 28 C34 14 56 17 73 33 C86 45 87 62 72 76 C56 91 33 83 25 68 C16 51 34 44 19 28Z" />
                <path className="landing-feature-link" d="M50 57 L24 42 M50 57 L76 39 M50 57 L59 25 M50 57 L34 71 M50 57 L68 73" />
                <path className="landing-feature-link landing-feature-link-soft" d="M24 42 L59 25 L76 39 M34 71 L50 57 L68 73 M24 42 L15 20 M76 39 L89 56 M34 71 L19 89" />
              </svg>
              {features.map((feature, index) => (
                <article
                  key={feature.className}
                  className={`landing-feature-orbit landing-feature-${feature.tier} ${feature.className}`}
                  style={{
                    '--reveal-delay': `${index * 55}ms`,
                    '--node-x': feature.visual.x,
                    '--node-y': feature.visual.y,
                    '--node-size': feature.visual.size,
                  } as LandingVisualStyle}
                >
                  <span>{feature.title}</span>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="landing-actions landing-hero-actions">
          <Link className="landing-action-link landing-action-secondary" to={routes.login}>
            {copy.secondary}
          </Link>
          <Link className="landing-action-link landing-action-primary" to={routes.register}>
            {copy.primary}
          </Link>
        </div>
      </section>
    </div>
  );
}
