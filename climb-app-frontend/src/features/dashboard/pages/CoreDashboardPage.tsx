import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot, { type MascotPose } from '../../../shared/components/illustration/GuideMascot';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import '../dashboard.css';

interface DashboardDayItem {
  key: string;
  label: string;
  dayNumber: string;
  date: Date;
  ariaLabel: string;
}

interface DashboardFocusItem {
  id: string;
  dateKey: string;
  title: string;
  description: string;
  metaLabel: string;
  timeLabel: string;
  to: string;
  pose: MascotPose;
}

function toDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatLongDate(date: Date, language: 'en' | 'zh') {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function buildWeekDays(language: 'en' | 'zh', today: Date) {
  const labels =
    language === 'zh'
      ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const first = startOfWeek(today);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(first, index);
    return {
      key: toDayKey(date),
      label: labels[index],
      dayNumber: `${date.getDate()}`,
      date,
      ariaLabel: formatLongDate(date, language),
    } satisfies DashboardDayItem;
  });
}

export default function CoreDashboardPage() {
  const { user, isProfileComplete } = useAuth();
  const { language, t } = useLanguage();
  const isZh = language === 'zh';
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const todayKey = toDayKey(today);
  const weekDays = useMemo(() => buildWeekDays(language, today), [language, today]);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);

  usePageTitle('Dashboard');

  const roleLabel = t(getRoleLabel(user?.role));
  const statusLabel = isProfileComplete
    ? (isZh ? '资料已就绪' : 'Profile ready')
    : (isZh ? '还差几项资料' : 'Finish a few details');

  const focusItems = useMemo<DashboardFocusItem[]>(
    () => [
      isProfileComplete
        ? {
            id: 'scan-today',
            dateKey: todayKey,
            title: isZh ? '开始新一轮墙面扫描' : 'Start a fresh wall scan',
            description: isZh
              ? '把整面墙拍进画面，作为今天路线引导的起点。'
              : 'Capture the full wall first and use it as the starting point for today’s guidance.',
            metaLabel: isZh ? '今日主任务' : 'Today focus',
            timeLabel: isZh ? '现在开始' : 'Start now',
            to: routes.scanWall,
            pose: 'celebrate',
          }
        : {
            id: 'profile-today',
            dateKey: todayKey,
            title: isZh ? '先把个人资料补完整' : 'Finish your profile first',
            description: isZh
              ? '身高、体重、生日和攀岩经验会影响后面的引导节奏。'
              : 'Height, weight, birthday, and climbing experience help shape the guidance flow.',
            metaLabel: isZh ? '今日主任务' : 'Today focus',
            timeLabel: isZh ? '优先处理' : 'Top priority',
            to: routes.profileEdit,
            pose: 'nod',
          },
      {
        id: 'guidance-next',
        dateKey: toDayKey(addDays(today, 1)),
        title: isZh ? '试听实时语音引导' : 'Preview live guidance',
        description: isZh
          ? '进入实时引导页，提前熟悉语音提示和攀爬节奏。'
          : 'Open the live guidance page and get familiar with spoken prompts before the next climb.',
        metaLabel: isZh ? '下一步' : 'Next step',
        timeLabel: isZh ? '明天' : 'Tomorrow',
        to: routes.liveGuidance,
        pose: 'nod',
      },
      {
        id: 'profile-review',
        dateKey: toDayKey(addDays(today, 3)),
        title: isZh ? '回看攀岩护照与备注' : 'Review your climbing passport',
        description: isZh
          ? '检查角色、个人说明和展示卡片，确保页面信息保持准确。'
          : 'Check your role, notes, and profile card so the dashboard stays aligned with you.',
        metaLabel: isZh ? '资料校对' : 'Profile review',
        timeLabel: isZh ? '本周中段' : 'Midweek',
        to: routes.profile,
        pose: 'tilt',
      },
      {
        id: 'scan-reset',
        dateKey: toDayKey(addDays(today, 5)),
        title: isZh ? '准备下一次扫描练习' : 'Prepare the next scan session',
        description: isZh
          ? '重新回到扫描页，测试更稳的取景和更清晰的墙面照片。'
          : 'Return to scanning and practise steadier framing with a clearer wall capture.',
        metaLabel: isZh ? '节奏回顾' : 'Rhythm check',
        timeLabel: isZh ? '周末前' : 'Before the weekend',
        to: routes.scanWall,
        pose: 'celebrate',
      },
    ],
    [isProfileComplete, isZh, today, todayKey],
  );

  const selectedDay = weekDays.find((day) => day.key === selectedDayKey) ?? weekDays[0];
  const selectedFocus = focusItems.find((item) => item.dateKey === selectedDay.key) ?? null;

  const hero = selectedFocus
    ? {
        tone: 'personal' as const,
        eyebrow: isZh ? `${selectedDay.label} / 今日焦点` : `${selectedDay.label} / Focus card`,
        title: selectedFocus.title,
        description: selectedFocus.description,
        metaPrimary: selectedFocus.timeLabel,
        metaSecondary: selectedFocus.metaLabel,
        ctaLabel: isZh ? '打开这个步骤' : 'Open this step',
        pose: selectedFocus.pose,
        moodLabel: isZh ? '小猴子已经准备好' : 'Mascot ready',
        to: selectedFocus.to,
      }
    : {
        tone: 'empty' as const,
        eyebrow: isZh ? `${selectedDay.label} / 空白日` : `${selectedDay.label} / Open day`,
        title: isZh ? '这一天留给你自由练习' : 'This day is open for free practice',
        description: isZh
          ? '没有固定安排时，就从墙面扫描开始，给下一次攀爬建立节奏。'
          : 'When the day is open, start from wall scanning and build the rhythm for the next climb.',
        metaPrimary: isZh ? '自由安排' : 'Open rhythm',
        metaSecondary: isZh ? '从扫描页重新出发' : 'Restart from the scan page',
        ctaLabel: isZh ? '开始扫描' : 'Start scan',
        pose: 'idle' as const,
        moodLabel: isZh ? '小猴子安静待机' : 'Mascot resting',
        to: routes.scanWall,
      };

  const guideTargets = focusItems.slice(0, 3);
  const quickCards = [
    {
      to: routes.scanWall,
      tone: 'assist',
      eyebrow: isZh ? '扫描' : 'Scan',
      title: isZh ? '识别整面墙' : 'Read the whole wall',
      description: isZh
        ? '上传或拍摄墙面，准备路线识别与后续引导。'
        : 'Upload or capture the wall and prepare route recognition for the next climb.',
      footer: isZh ? '进入扫描页' : 'Open scan',
    },
    {
      to: routes.liveGuidance,
      tone: 'assist',
      eyebrow: isZh ? '引导' : 'Guidance',
      title: isZh ? '进入实时提示' : 'Open live prompts',
      description: isZh
        ? '在实时引导页试听语音提示，感受攀爬节奏。'
        : 'Use the live guidance screen when you want spoken prompts during movement.',
      footer: isZh ? '打开引导' : 'Open guidance',
    },
    {
      to: routes.profileEdit,
      tone: 'profile',
      eyebrow: isZh ? '资料' : 'Profile',
      title: isZh ? '更新个人信息' : 'Tune your details',
      description: isZh
        ? '保持经验、备注和基础资料最新，方便系统给出更稳的引导。'
        : 'Keep your experience, notes, and basics current so the app can stay aligned.',
      footer: isZh ? '编辑资料' : 'Edit profile',
    },
    {
      to: routes.profile,
      tone: 'stats',
      eyebrow: isZh ? '记录' : 'Record',
      title: isZh ? '查看攀岩护照' : 'Review your climbing passport',
      description: isZh
        ? '回看角色、徽章和展示卡片，把页面记录整理清楚。'
        : 'Check your role, badges, and profile card from one place.',
      footer: isZh ? '打开资料页' : 'Open profile',
    },
  ] as const;

  return (
    <div className="dashboard-page stack-lg">
      <header className="dashboard-header" aria-label={isZh ? '仪表板顶部区域' : 'Dashboard header'}>
        <div className="dashboard-header-copy">
          <p className="dashboard-header-kicker">{isZh ? '今日仪表板' : 'Today on Climb Together'}</p>
          <h1>{isZh ? `你好，${user?.username ?? 'Climber'}` : `Hi, ${user?.username ?? 'Climber'}`}</h1>
          <p className="dashboard-header-subcopy">
            {isZh
              ? '周历、主视觉卡片和快捷入口都回来了，但功能仍然只围绕攀爬辅助主线。'
              : 'The calendar strip, hero card, and visual dashboard elements are back, while the flow stays focused on climbing guidance.'}
          </p>
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

      <section className="dashboard-guide-card dashboard-guide-card--expanded" aria-label={isZh ? '今日草图板' : 'Today sketchbook'}>
        <div className="dashboard-guide-card-head">
          <div className="dashboard-guide-card-copy">
            <span className="dashboard-section-kicker">{isZh ? '手绘提示板' : 'Sketchbook panel'}</span>
            <p className="dashboard-guide-intro">
              {isZh
                ? '这块卡片保留了仪表板原本更有设计感的层次，用来快速切换今天最重要的几个动作。'
                : 'This panel keeps the dashboard’s more illustrated feel and lets you hop between the main actions for the week.'}
            </p>
          </div>

          <div className="dashboard-guide-card-controls">
            <span className="dashboard-guide-badge">{selectedDay.label}</span>
            <span className="dashboard-guide-step-count">{formatLongDate(selectedDay.date, language)}</span>
          </div>
        </div>

        <div className="dashboard-guide-stage">
          <div className="dashboard-guide-mascot-panel">
            <GuideMascot className="dashboard-guide-mascot" pose={hero.pose} />
          </div>

          <div className="dashboard-guide-dialog">
            <div className="dashboard-guide-dialog-meta">
              <span className="dashboard-guide-badge">{isZh ? '本周小抄' : 'Weekly sketch notes'}</span>
              <span className="dashboard-guide-step-count">{isZh ? '3 个快捷跳点' : '3 quick jump points'}</span>
            </div>

            <div className="dashboard-guide-dialog-body">
              <h2>{hero.title}</h2>
              <p>{hero.description}</p>
            </div>

            <div className="dashboard-guide-progress">
              {guideTargets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`dashboard-guide-pill ${selectedDayKey === item.dateKey ? 'is-active' : ''}`.trim()}
                  onClick={() => setSelectedDayKey(item.dateKey)}
                >
                  {item.timeLabel}
                </button>
              ))}
            </div>

            <p className="dashboard-guide-helper">
              {isProfileComplete
                ? (isZh
                  ? '资料已完整，接下来主要把重心放在扫描和实时引导。'
                  : 'Your profile is complete, so the next rhythm stays centred on scanning and live guidance.')
                : (isZh
                  ? '如果先补齐资料，后面的引导和页面捷径会更稳。'
                  : 'If you finish the profile basics first, the later guidance flow will stay more reliable.')}
            </p>
          </div>
        </div>
      </section>

      <section className="dashboard-strip-shell" aria-label={isZh ? '日期记录条' : 'Date record strip'}>
        <div className="dashboard-strip-intro">
          <div className="stack-xs">
            <span className="dashboard-section-kicker">{isZh ? '日期记录' : 'Date record'}</span>
            <p className="dashboard-strip-summary">
              {isZh
                ? '这条周历会把本周的重点日期重新标出来。'
                : 'This weekly strip brings the calendar-style date record back into the dashboard.'}
            </p>
          </div>
          <p className="dashboard-strip-hint">{formatLongDate(selectedDay.date, language)}</p>
        </div>

        <div className="dashboard-week-strip" role="list">
          {weekDays.map((day) => {
            const hasFocus = focusItems.some((item) => item.dateKey === day.key);
            const isSelected = day.key === selectedDayKey;

            return (
              <button
                key={day.key}
                type="button"
                className={`dashboard-week-item ${isSelected ? 'is-selected' : ''}`.trim()}
                onClick={() => setSelectedDayKey(day.key)}
                aria-pressed={isSelected}
                aria-label={`${day.ariaLabel}. ${hasFocus ? (isZh ? '有重点安排。' : 'Has a focus item.') : (isZh ? '自由安排。' : 'Open day.')}`}
              >
                <span className="dashboard-week-label">{day.label}</span>
                <strong className="dashboard-week-number">{day.dayNumber}</strong>
                <span className="dashboard-week-dots" aria-hidden="true">
                  <span className={`dashboard-week-dot ${hasFocus ? 'dashboard-week-dot--personal' : 'dashboard-week-dot--quiet'}`} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="dashboard-hero-section" aria-label={isZh ? '主视觉焦点卡片' : 'Hero card'}>
        <Link
          to={hero.to}
          className={`dashboard-hero-link dashboard-hero-link--${hero.tone}`.trim()}
          aria-label={`${formatLongDate(selectedDay.date, language)}. ${hero.title}. ${hero.description}`}
        >
          <article className={`dashboard-hero-card dashboard-hero-card--${hero.tone}`.trim()}>
            <div className="dashboard-hero-copy">
              <span className="dashboard-hero-eyebrow">{hero.eyebrow}</span>

              <div className="dashboard-hero-stack">
                <h2>{hero.title}</h2>
                <p>{hero.description}</p>
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
              <span className="dashboard-hero-illustration-label">{hero.moodLabel}</span>
              <GuideMascot className="guide-mascot dashboard-hero-mascot" pose={hero.pose} />
            </div>
          </article>
        </Link>
      </section>

      <section className="dashboard-actions-section" aria-label={isZh ? '快捷入口区' : 'Quick actions'}>
        <div className="dashboard-actions-header">
          <div className="stack-xs">
            <span className="dashboard-section-kicker">{isZh ? '快捷入口' : 'Quick actions'}</span>
            <p className="dashboard-actions-summary">
              {isZh
                ? '保留主要功能，但把仪表板原本的图形层次和卡片密度补回来了。'
                : 'The dashboard keeps the main features while bringing back the richer card layout and decorative rhythm.'}
            </p>
          </div>
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
              <p className="dashboard-action-copy">{card.description}</p>
              <span className="dashboard-action-footer">{card.footer}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-secondary-grid">
        <Card title={isZh ? '日期备注' : 'Date notes'} className="dashboard-secondary-card dashboard-secondary-card--role">
          <div className="stack-sm">
            <p>
              {selectedFocus
                ? `${formatLongDate(selectedDay.date, language)}. ${selectedFocus.description}`
                : (isZh
                  ? `${formatLongDate(selectedDay.date, language)}。这一天没有固定安排，可以自由返回扫描页或资料页。`
                  : `${formatLongDate(selectedDay.date, language)}. This day is open, so you can freely return to the scan page or profile pages.`)}
            </p>

            <div className="inline-actions wrap">
              <Link className="text-link" to={hero.to}>{hero.ctaLabel}</Link>
              <Link className="text-link" to={routes.dashboard}>{isZh ? '回到今日焦点' : 'Back to today focus'}</Link>
            </div>
          </div>
        </Card>

        <Card title={isZh ? '资料检查' : 'Profile check'} className="dashboard-secondary-card dashboard-secondary-card--notice">
          <div className="stack-sm">
            <p>
              {isProfileComplete
                ? (isZh
                  ? '你的资料已经满足主流程使用，后面可以把重心放在扫描、路线和实时语音引导。'
                  : 'Your profile is ready for the core flow, so you can stay focused on scanning, routes, and live spoken guidance.')
                : (isZh
                  ? '先补全资料，再进入扫描和引导，会让整个主流程更顺。'
                  : 'Finish the profile basics before scanning and guidance so the main flow stays smoother.')}
            </p>

            <div className="inline-actions wrap">
              <Link className="text-link" to={routes.profile}>{isZh ? '查看资料' : 'Open profile'}</Link>
              {!isProfileComplete ? (
                <Link className="text-link" to={routes.profileEdit}>{isZh ? '现在完善' : 'Complete profile'}</Link>
              ) : null}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
