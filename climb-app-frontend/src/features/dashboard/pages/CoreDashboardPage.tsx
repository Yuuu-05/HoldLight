import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import '../dashboard.css';

export default function CoreDashboardPage() {
  const { user, isProfileComplete } = useAuth();
  const { language, t } = useLanguage();
  const isZh = language === 'zh';
  usePageTitle('Dashboard');

  const roleLabel = t(getRoleLabel(user?.role));
  const statusLabel = isProfileComplete
    ? (isZh ? '资料已就绪' : 'Profile ready')
    : (isZh ? '还差几项资料' : 'Finish profile');

  const hero = isProfileComplete
    ? {
        tone: 'personal' as const,
        eyebrow: isZh ? '今日任务' : 'Today',
        title: isZh ? '开始墙面扫描' : 'Start wall scan',
        metaPrimary: isZh ? '现在开始' : 'Start now',
        metaSecondary: isZh ? '扫描后选择路线' : 'Choose route after scan',
        ctaLabel: isZh ? '去扫描' : 'Scan',
        pose: 'celebrate' as const,
        to: routes.scanWall,
      }
    : {
        tone: 'empty' as const,
        eyebrow: isZh ? '先完成资料' : 'Profile needed',
        title: isZh ? '补全个人资料' : 'Finish your profile',
        metaPrimary: isZh ? '优先处理' : 'Top priority',
        metaSecondary: isZh ? '完成后开始扫描' : 'Scan after setup',
        ctaLabel: isZh ? '去完善' : 'Edit profile',
        pose: 'nod' as const,
        to: routes.profileEdit,
      };

  const quickCards = [
    {
      to: routes.scanWall,
      tone: 'assist',
      eyebrow: isZh ? '扫描' : 'Scan',
      title: isZh ? '墙面识别' : 'Wall scan',
      footer: isZh ? '打开' : 'Open',
    },
    {
      to: routes.liveGuidance,
      tone: 'assist',
      eyebrow: isZh ? '引导' : 'Guidance',
      title: isZh ? '实时提示' : 'Live prompts',
      footer: isZh ? '打开' : 'Open',
    },
    {
      to: routes.profileEdit,
      tone: 'profile',
      eyebrow: isZh ? '资料' : 'Profile',
      title: isZh ? '编辑资料' : 'Edit profile',
      footer: isZh ? '打开' : 'Open',
    },
    {
      to: routes.profile,
      tone: 'stats',
      eyebrow: isZh ? '账户' : 'Account',
      title: isZh ? '我的资料' : 'My profile',
      footer: isZh ? '打开' : 'Open',
    },
  ] as const;

  return (
    <div className="dashboard-page stack-lg">
      <header className="dashboard-header" aria-label={isZh ? '仪表板' : 'Dashboard'}>
        <div className="dashboard-header-copy">
          <h1>{isZh ? `你好，${user?.username ?? '攀岩者'}` : `Hi, ${user?.username ?? 'Climber'}`}</h1>
        </div>

        <div className="dashboard-header-meta">
          <div className="dashboard-avatar-stack">
            <div className="dashboard-avatar" aria-hidden="true">
              {(user?.username ?? 'C').trim().slice(0, 1).toUpperCase()}
            </div>
            <span className="dashboard-status-pill">{statusLabel}</span>
          </div>
          <span className="dashboard-role-caption">{roleLabel}</span>
        </div>
      </header>

      <section className="dashboard-hero-section" aria-label={isZh ? '当前任务' : 'Current task'}>
        <Link
          to={hero.to}
          className={`dashboard-hero-link dashboard-hero-link--${hero.tone}`.trim()}
          aria-label={`${hero.title}. ${hero.ctaLabel}`}
        >
          <article className={`dashboard-hero-card dashboard-hero-card--${hero.tone}`.trim()}>
            <div className="dashboard-hero-copy">
              <span className="dashboard-hero-eyebrow">{hero.eyebrow}</span>

              <div className="dashboard-hero-stack">
                <h2>{hero.title}</h2>
              </div>

              <div className="dashboard-hero-footer">
                <div className="dashboard-hero-meta">
                  <strong>{hero.metaPrimary}</strong>
                  <span>{hero.metaSecondary}</span>
                </div>
                <span className="dashboard-hero-cta">{hero.ctaLabel}</span>
              </div>
            </div>

            <div className="dashboard-hero-illustration" aria-hidden="true">
              <GuideMascot className="guide-mascot dashboard-hero-mascot" pose={hero.pose} />
            </div>
          </article>
        </Link>
      </section>

      <section className="dashboard-actions-section" aria-label={isZh ? '快捷入口' : 'Quick actions'}>
        <div className="dashboard-actions-header">
          <h2 className="dashboard-section-kicker">{isZh ? '快捷入口' : 'Quick actions'}</h2>
        </div>

        <div className="dashboard-actions-grid">
          {quickCards.map((card) => (
            <Link
              key={card.title}
              to={card.to}
              className={`dashboard-action-card dashboard-action-card--${card.tone}`.trim()}
            >
              <span className="dashboard-action-mark" aria-hidden="true" />
              <span className="dashboard-action-kicker">{card.eyebrow}</span>
              <strong className="dashboard-action-title">{card.title}</strong>
              <span className="dashboard-action-footer">{card.footer}</span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
