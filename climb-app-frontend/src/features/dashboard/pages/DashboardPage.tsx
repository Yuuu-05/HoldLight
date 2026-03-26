import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot, { type MascotPose } from '../../../shared/components/illustration/GuideMascot';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import { tutorialModules } from '../../../shared/constants/tutorial';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import DashboardGuideCard from '../components/DashboardGuideCard';
import { useTutorialProgress } from '../../tutorial/hooks/useTutorialProgress';
import { useVolunteerBoard } from '../../volunteer/hooks/useVolunteerBoard';
import { useRooms } from '../../social/hooks/useRooms';
import ExperiencedHomePage from './ExperiencedHomePage';
import NewUserHomePage from './NewUserHomePage';
import VisuallyImpairedHomePage from './VisuallyImpairedHomePage';
import VolunteerHomePage from './VolunteerHomePage';
import '../dashboard.css';

type DashboardScheduleType = 'personal' | 'volunteer' | 'invite';
type DashboardHeroTone = 'empty' | DashboardScheduleType;
type DashboardQuickTone = 'tutorial' | 'social' | 'volunteer' | 'stats';

interface DashboardScheduleEvent {
  id: string;
  dateKey: string;
  type: DashboardScheduleType;
  title: string;
  description: string;
  timeLabel: string;
  metaLabel: string;
  to: string;
  pulse?: boolean;
}

interface DashboardDayItem {
  key: string;
  label: string;
  dayNumber: string;
  date: Date;
  ariaLabel: string;
}

interface DashboardHeroContent {
  key: string;
  to: string;
  tone: DashboardHeroTone;
  eyebrow: string;
  title: string;
  description: string;
  metaPrimary: string;
  metaSecondary: string;
  ctaLabel: string;
  pose: MascotPose;
  pulse: boolean;
  moodLabel: string;
  ariaLabel: string;
}

interface DashboardQuickCard {
  to: string;
  tone: DashboardQuickTone;
  eyebrow: string;
  title: string;
  description: string;
  footer: string;
  pulse: boolean;
  ariaLabel: string;
}

const SCHEDULE_TYPE_ORDER: DashboardScheduleType[] = ['personal', 'volunteer', 'invite'];

function toDayKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatShortTime(value: string, language: 'en' | 'zh') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatLongDate(date: Date, language: 'en' | 'zh') {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function truncateText(value: string, limit = 84) {
  return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}...`;
}

function getWeekDays(language: 'en' | 'zh', today: Date) {
  const labels =
    language === 'zh'
      ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const first = startOfWeek(today);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return {
      key: toDayKey(date),
      label: labels[index],
      dayNumber: `${date.getDate()}`,
      date,
      ariaLabel: formatLongDate(date, language),
    } satisfies DashboardDayItem;
  });
}

function getRoleStatus(role: string | undefined, isZh: boolean) {
  switch (role) {
    case 'volunteer':
      return isZh ? '志愿者在线' : 'Volunteer online';
    case 'visually_impaired':
      return isZh ? '语音优先模式' : 'Voice-first mode';
    case 'experienced':
      return isZh ? '进阶路线就绪' : 'Ready for hard routes';
    default:
      return isZh ? '新手探索中' : 'Exploring basics';
  }
}

function getScheduleTypeLabel(type: DashboardScheduleType, isZh: boolean) {
  switch (type) {
    case 'personal':
      return isZh ? '个人攀岩计划' : 'personal plan';
    case 'volunteer':
      return isZh ? '志愿者帮扶' : 'volunteer help';
    case 'invite':
      return isZh ? '社区邀请' : 'community invite';
    default:
      return type;
  }
}

function buildDaySummary(events: DashboardScheduleEvent[], isZh: boolean) {
  if (!events.length) {
    return isZh ? '今天暂无日程' : 'No events planned';
  }

  const counts = events.reduce<Record<DashboardScheduleType, number>>(
    (accumulator, event) => {
      accumulator[event.type] += 1;
      return accumulator;
    },
    { personal: 0, volunteer: 0, invite: 0 },
  );

  const parts = SCHEDULE_TYPE_ORDER.filter((type) => counts[type] > 0).map((type) => {
    const count = counts[type];
    return isZh ? `${getScheduleTypeLabel(type, isZh)}${count > 1 ? ` ${count} 项` : ''}` : `${count > 1 ? `${count} ` : ''}${getScheduleTypeLabel(type, isZh)}`;
  });

  return isZh ? `本日安排：${parts.join('，')}` : `Planned items: ${parts.join(', ')}`;
}

function getHeroPose(type: DashboardScheduleType | 'empty'): MascotPose {
  switch (type) {
    case 'volunteer':
      return 'nod';
    case 'invite':
      return 'tilt';
    case 'personal':
      return 'celebrate';
    default:
      return 'idle';
  }
}

export default function DashboardPage() {
  const { user, isProfileComplete } = useAuth();
  const { language, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { completedCount, completionRate, isComplete, nextModule } = useTutorialProgress();
  const { items, upcomingSessions } = useVolunteerBoard();
  const { rooms, invitations, unreadRoomIds, myRooms } = useRooms();
  const [selectedDayKey, setSelectedDayKey] = useState(() => toDayKey(new Date()));
  const [manualGuideOpen, setManualGuideOpen] = useState(
    () => new URLSearchParams(location.search).get('guide') === 'replay',
  );

  usePageTitle('Dashboard');

  const isZh = language === 'zh';
  const today = useMemo(() => new Date(), []);
  const todayKey = toDayKey(today);
  const weekDays = useMemo(() => getWeekDays(language, today), [language, today]);
  const replayGuideRequested = useMemo(
    () => new URLSearchParams(location.search).get('guide') === 'replay',
    [location.search],
  );
  const shouldAutoOpenGuide = !user?.preferences?.onboarding?.guideCompleted || manualGuideOpen;

  useEffect(() => {
    if (!weekDays.some((day) => day.key === selectedDayKey)) {
      setSelectedDayKey(todayKey);
    }
  }, [selectedDayKey, todayKey, weekDays]);

  useEffect(() => {
    if (!replayGuideRequested) {
      return;
    }

    setManualGuideOpen(true);
    navigate(routes.dashboard, { replace: true });
  }, [navigate, replayGuideRequested]);

  const roleLabel = t(getRoleLabel(user?.role));
  const roleStatus = getRoleStatus(user?.role, isZh);
  const pendingInvitations = useMemo(
    () => invitations.filter((invite) => invite.status === 'pending'),
    [invitations],
  );
  const latestVolunteerRequest = useMemo(
    () => [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null,
    [items],
  );

  const rolePanel = (() => {
    switch (user?.role) {
      case 'visually_impaired':
        return <VisuallyImpairedHomePage />;
      case 'volunteer':
        return <VolunteerHomePage />;
      case 'experienced':
        return <ExperiencedHomePage />;
      default:
        return <NewUserHomePage />;
    }
  })();

  const scheduleEvents = useMemo<DashboardScheduleEvent[]>(() => {
    const next: DashboardScheduleEvent[] = [];

    if (!isComplete) {
      next.push({
        id: `personal-${nextModule.id}`,
        dateKey: todayKey,
        type: 'personal',
        title: isZh ? `继续学习 ${t(nextModule.title)}` : `Continue ${t(nextModule.title)}`,
        description: isZh
          ? '先推进新手教程，把基础规则和安全认知补齐。'
          : 'Keep your beginner path moving before jumping into harder flows.',
        timeLabel: isZh ? '今日重点' : 'Today focus',
        metaLabel: isZh ? `教程进度 ${completionRate}%` : `Tutorial progress ${completionRate}%`,
        to: nextModule.route,
      });
    }

    upcomingSessions.forEach((session) => {
      next.push({
        id: `volunteer-${session.id}`,
        dateKey: toDayKey(session.sessionTime),
        type: 'volunteer',
        title: session.title,
        description: isZh
          ? `${session.location}。志愿者支持已经排入日程。`
          : `${session.location}. Volunteer support is already on your schedule.`,
        timeLabel: formatShortTime(session.sessionTime, language),
        metaLabel: isZh ? '志愿者帮扶' : 'Volunteer support',
        to: routes.volunteerMySessions,
        pulse: toDayKey(session.sessionTime) === todayKey,
      });
    });

    pendingInvitations.forEach((invite) => {
      next.push({
        id: `invite-${invite.id}`,
        dateKey: todayKey,
        type: 'invite',
        title: isZh ? `${invite.invitedByName} 邀请你加入房间` : `${invite.invitedByName} invited you to a room`,
        description: isZh
          ? `房间 ${invite.roomName} 正在等待你的回应。`
          : `${invite.roomName} is waiting for your response.`,
        timeLabel: isZh ? '待处理' : 'Pending',
        metaLabel: isZh ? '社区邀请' : 'Community invite',
        to: routes.socialRooms,
        pulse: true,
      });
    });

    return next.sort((left, right) => {
      const weight = { volunteer: 0, invite: 1, personal: 2 };
      return weight[left.type] - weight[right.type];
    });
  }, [
    completionRate,
    isComplete,
    isZh,
    language,
    nextModule.id,
    nextModule.route,
    pendingInvitations,
    t,
    todayKey,
    upcomingSessions,
  ]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DashboardScheduleEvent[]>();
    scheduleEvents.forEach((event) => {
      const current = map.get(event.dateKey) ?? [];
      current.push(event);
      map.set(event.dateKey, current);
    });
    return map;
  }, [scheduleEvents]);

  const selectedDay = weekDays.find((day) => day.key === selectedDayKey) ?? weekDays[0];
  const selectedEvents = eventsByDate.get(selectedDayKey) ?? [];
  const primaryEvent = selectedEvents[0] ?? null;

  const hero = useMemo<DashboardHeroContent>(() => {
    if (!primaryEvent) {
      return {
        key: `empty-${selectedDayKey}`,
        to: routes.scanWall,
        tone: 'empty',
        eyebrow: isZh ? `${selectedDay.label} / 空档` : `${selectedDay.label} / Open slot`,
        title: isZh ? 'Scan & Climb' : 'Scan & Climb',
        description: isZh
          ? '今天没有固定日程，可以直接进入墙面扫描，开启新的路线引导。'
          : 'No fixed plans today. Scan the wall and launch a fresh route guidance flow.',
        metaPrimary: isZh ? '默认核心操作' : 'Default focus action',
        metaSecondary: isZh ? '墙面扫描与路线引导' : 'Wall scan and route guidance',
        ctaLabel: isZh ? '开始扫描' : 'Start scan',
        pose: getHeroPose('empty'),
        pulse: false,
        moodLabel: isZh ? '小猴子安静待机' : 'Mascot resting',
        ariaLabel: isZh
          ? `${selectedDay.ariaLabel}。今天没有固定日程。点击进入墙面扫描与路线引导。`
          : `${selectedDay.ariaLabel}. No fixed plans today. Open wall scan and route guidance.`,
      };
    }

    if (primaryEvent.type === 'volunteer') {
      return {
        key: primaryEvent.id,
        to: primaryEvent.to,
        tone: 'volunteer',
        eyebrow: isZh ? `${selectedDay.label} / 志愿者` : `${selectedDay.label} / Volunteer`,
        title: primaryEvent.title,
        description: primaryEvent.description,
        metaPrimary: primaryEvent.timeLabel,
        metaSecondary: primaryEvent.metaLabel,
        ctaLabel: isZh ? '打开我的安排' : 'Open my sessions',
        pose: getHeroPose(primaryEvent.type),
        pulse: primaryEvent.pulse ?? false,
        moodLabel: isZh ? '小猴子进入向导状态' : 'Mascot guide mode',
        ariaLabel: isZh
          ? `${selectedDay.ariaLabel}。${primaryEvent.timeLabel}。${primaryEvent.title}。${primaryEvent.description}。${primaryEvent.metaLabel}。点击打开我的安排。`
          : `${selectedDay.ariaLabel}. ${primaryEvent.timeLabel}. ${primaryEvent.title}. ${primaryEvent.description}. ${primaryEvent.metaLabel}. Open my sessions.`,
      };
    }

    if (primaryEvent.type === 'invite') {
      return {
        key: primaryEvent.id,
        to: primaryEvent.to,
        tone: 'invite',
        eyebrow: isZh ? `${selectedDay.label} / 邀请` : `${selectedDay.label} / Invite`,
        title: primaryEvent.title,
        description: primaryEvent.description,
        metaPrimary: primaryEvent.timeLabel,
        metaSecondary: primaryEvent.metaLabel,
        ctaLabel: isZh ? '打开房间中心' : 'Open room hub',
        pose: getHeroPose(primaryEvent.type),
        pulse: primaryEvent.pulse ?? false,
        moodLabel: isZh ? '小猴子正在招呼你' : 'Mascot calling you in',
        ariaLabel: isZh
          ? `${selectedDay.ariaLabel}。${primaryEvent.timeLabel}。${primaryEvent.title}。${primaryEvent.description}。${primaryEvent.metaLabel}。点击打开房间中心。`
          : `${selectedDay.ariaLabel}. ${primaryEvent.timeLabel}. ${primaryEvent.title}. ${primaryEvent.description}. ${primaryEvent.metaLabel}. Open room hub.`,
      };
    }

    return {
      key: primaryEvent.id,
      to: primaryEvent.to,
      tone: 'personal',
      eyebrow: isZh ? `${selectedDay.label} / 个人计划` : `${selectedDay.label} / Personal plan`,
      title: primaryEvent.title,
      description: primaryEvent.description,
      metaPrimary: primaryEvent.timeLabel,
      metaSecondary: primaryEvent.metaLabel,
      ctaLabel: isZh ? '继续教程' : 'Continue tutorial',
      pose: getHeroPose(primaryEvent.type),
      pulse: false,
      moodLabel: isZh ? '小猴子进入热身状态' : 'Mascot warming up',
      ariaLabel: isZh
        ? `${selectedDay.ariaLabel}。${primaryEvent.timeLabel}。${primaryEvent.title}。${primaryEvent.description}。${primaryEvent.metaLabel}。点击继续教程。`
        : `${selectedDay.ariaLabel}. ${primaryEvent.timeLabel}. ${primaryEvent.title}. ${primaryEvent.description}. ${primaryEvent.metaLabel}. Continue tutorial.`,
    };
  }, [isZh, primaryEvent, selectedDay.ariaLabel, selectedDay.label, selectedDayKey]);

  const quickCards = useMemo<DashboardQuickCard[]>(() => {
    const tutorialSummary = isComplete
      ? isZh
        ? '新手路径已完成'
        : 'Beginner path complete'
      : `${t(nextModule.title)} · ${completionRate}%`;

    const tutorialDescription = isComplete
      ? isZh
        ? '回顾规则、装备、术语和安全知识，保持手感。'
        : 'Review rules, equipment, terms, and safety.'
      : isZh
        ? `当前已完成 ${completedCount}/${tutorialModules.length} 个模块。`
        : `Completed ${completedCount}/${tutorialModules.length} modules so far.`;

    const socialTitle = pendingInvitations.length
      ? isZh
        ? `${pendingInvitations.length} 个新邀请`
        : `${pendingInvitations.length} new invites`
      : unreadRoomIds.length
        ? isZh
          ? `${unreadRoomIds.length} 个房间有更新`
          : `${unreadRoomIds.length} active rooms`
        : isZh
          ? `${rooms.length} 个房间可加入`
          : `${rooms.length} rooms available`;

    const socialDescription = pendingInvitations.length
      ? isZh
        ? '你的房间邀请正在等待回应。'
        : 'Your room invitations are waiting for a response.'
      : unreadRoomIds.length
        ? isZh
          ? '有些房间出现了新动态，可以直接返回查看。'
          : 'Some rooms have new activity waiting for you.'
        : isZh
          ? '浏览附近房间，加入队伍或继续交流。'
          : 'Browse rooms, join a team, or continue a conversation.';

    const volunteerTitle = latestVolunteerRequest
      ? latestVolunteerRequest.title
      : isZh
        ? '查看最新求助'
        : 'Browse latest support requests';

    const volunteerDescription = latestVolunteerRequest
      ? truncateText(
          isZh
            ? `${latestVolunteerRequest.location}。${latestVolunteerRequest.notes}`
            : `${latestVolunteerRequest.location}. ${latestVolunteerRequest.notes}`,
        )
      : isZh
        ? '公告栏会展示最近一条志愿者求助信息。'
        : 'The board highlights the most recent volunteer support requests.';

    const statsDescription = isZh
      ? `教程 ${completedCount} · 房间 ${myRooms.length} · 志愿安排 ${upcomingSessions.length}`
      : `Tutorial ${completedCount} · Rooms ${myRooms.length} · Support ${upcomingSessions.length}`;

    return [
      {
        to: isComplete ? routes.tutorialHome : nextModule.route,
        tone: 'tutorial',
        eyebrow: 'Tutorial',
        title: tutorialSummary,
        description: tutorialDescription,
        footer: isZh ? '继续学习路径' : 'Continue the learning path',
        pulse: !isComplete && completionRate < 100,
        ariaLabel: isZh
          ? `Tutorial。${tutorialSummary}。${tutorialDescription}。${isComplete ? '进入教程首页。' : '继续当前教程模块。'}`
          : `Tutorial. ${tutorialSummary}. ${tutorialDescription}. ${isComplete ? 'Open the tutorial home.' : 'Continue the current tutorial module.'}`,
      },
      {
        to: routes.socialRooms,
        tone: 'social',
        eyebrow: 'Social Rooms',
        title: socialTitle,
        description: socialDescription,
        footer: isZh ? '打开房间中心' : 'Open room hub',
        pulse: pendingInvitations.length > 0,
        ariaLabel: isZh
          ? `Social Rooms。${socialTitle}。${socialDescription}。打开房间中心。`
          : `Social Rooms. ${socialTitle}. ${socialDescription}. Open room hub.`,
      },
      {
        to: routes.volunteerBoard,
        tone: 'volunteer',
        eyebrow: 'Volunteer Board',
        title: volunteerTitle,
        description: volunteerDescription,
        footer: isZh ? '查看求助信息' : 'View support board',
        pulse: Boolean(latestVolunteerRequest && latestVolunteerRequest.applicants.length === 0),
        ariaLabel: isZh
          ? `Volunteer Board。${volunteerTitle}。${volunteerDescription}。查看求助信息。`
          : `Volunteer Board. ${volunteerTitle}. ${volunteerDescription}. View support board.`,
      },
      {
        to: routes.profile,
        tone: 'stats',
        eyebrow: isZh ? '我的数据' : 'My stats',
        title: isZh ? '本周概览' : 'This week at a glance',
        description: statsDescription,
        footer: isZh ? '打开个人资料' : 'Open profile',
        pulse: false,
        ariaLabel: isZh
          ? `My stats。${statsDescription}。打开个人资料。`
          : `My stats. ${statsDescription}. Open profile.`,
      },
    ];
  }, [
    completedCount,
    completionRate,
    isComplete,
    isZh,
    latestVolunteerRequest,
    myRooms.length,
    nextModule.route,
    pendingInvitations.length,
    rooms.length,
    t,
    unreadRoomIds.length,
    upcomingSessions.length,
  ]);

  const dayButtons = weekDays.map((day) => {
    const dayEvents = eventsByDate.get(day.key) ?? [];
    const eventTypes = SCHEDULE_TYPE_ORDER.filter((type) => dayEvents.some((event) => event.type === type));
    const isSelected = day.key === selectedDayKey;
    const ariaLabel = `${day.ariaLabel}. ${buildDaySummary(dayEvents, isZh)}${isSelected ? (isZh ? '。当前选中。' : '. Selected.') : ''}`;

    return (
      <button
        key={day.key}
        type="button"
        className={`dashboard-week-item ${isSelected ? 'is-selected' : ''}`.trim()}
        onClick={() => setSelectedDayKey(day.key)}
        aria-pressed={isSelected}
        aria-label={ariaLabel}
      >
        <span className="dashboard-week-label">{day.label}</span>
        <strong className="dashboard-week-number">{day.dayNumber}</strong>
        <span className="dashboard-week-dots" aria-hidden="true">
          {eventTypes.length ? (
            eventTypes.map((type) => <span key={type} className={`dashboard-week-dot dashboard-week-dot--${type}`.trim()} />)
          ) : (
            <span className="dashboard-week-dot dashboard-week-dot--quiet" />
          )}
        </span>
      </button>
    );
  });

  return (
    <div className="dashboard-page">
      <header className="dashboard-header" aria-label={isZh ? '仪表盘问候与身份区' : 'Dashboard greeting and identity'}>
        <div className="dashboard-header-copy">
          <p className="dashboard-header-kicker">{isZh ? '今日仪表盘' : 'Today on Climb Together'}</p>
          <h1>{`Hi, ${user?.username ?? 'Climber'}`}</h1>
          <p className="dashboard-header-subcopy">
            {isZh
              ? '先看本周节奏，再进入今天最重要的动作。'
              : 'Check this week first, then jump into the most important action from the hero card.'}
          </p>
        </div>

        <div className="dashboard-header-meta">
          <div className="dashboard-avatar-stack">
            <div className="dashboard-avatar" aria-hidden="true">
              {(user?.username ?? 'C').trim().slice(0, 1).toUpperCase()}
            </div>
            <span className="dashboard-status-pill">{roleStatus}</span>
          </div>
          <span className="dashboard-role-caption">{roleLabel}</span>
        </div>
      </header>

      <DashboardGuideCard
        autoOpen={shouldAutoOpenGuide}
        onAutoOpenHandled={() => setManualGuideOpen(false)}
      />

      <section className="dashboard-strip-shell" aria-label={isZh ? '本周日程轴' : 'Weekly schedule strip'}>
        <div className="dashboard-strip-intro">
          <div className="stack-xs">
            <span className="dashboard-section-kicker">{isZh ? '本周节奏' : 'Weekly rhythm'}</span>
            <p className="dashboard-strip-summary">
              {isZh ? '点选日期，预览当天的主任务。' : 'Tap any day to preview the main task.'}
            </p>
          </div>
          <p className="dashboard-strip-hint">{isZh ? 'Mon-Sun 横向滑动' : 'Mon-Sun horizontal scroll'}</p>
        </div>

        <div className="dashboard-week-strip" role="list">
          {dayButtons}
        </div>
      </section>

      <section className="dashboard-hero-section" aria-label={isZh ? '主视觉焦点卡片' : 'Hero action card'}>
        <Link to={hero.to} className={`dashboard-hero-link dashboard-hero-link--${hero.tone}`.trim()} aria-label={hero.ariaLabel}>
          <article
            key={hero.key}
            className={`dashboard-hero-card dashboard-hero-card--${hero.tone} ${hero.pulse ? 'is-pulsing' : ''}`.trim()}
            style={{ viewTransitionName: 'dashboard-hero-card' }}
          >
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
                  {selectedEvents.length > 1 ? (
                    <small>{isZh ? `另外 ${selectedEvents.length - 1} 项` : `+${selectedEvents.length - 1} more items`}</small>
                  ) : null}
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

      <section className="dashboard-actions-section" aria-label={isZh ? '功能魔方阵' : 'Quick actions'}>
        <div className="dashboard-actions-header">
          <div className="stack-xs">
            <span className="dashboard-section-kicker">{isZh ? '功能入口' : 'Quick actions'}</span>
            <p className="dashboard-actions-summary">
              {isZh ? '四个快捷卡片，集中收纳主要功能。' : 'Four calm shortcuts, each tuned to today’s rhythm.'}
            </p>
          </div>
        </div>

        <div className="dashboard-actions-grid">
          {quickCards.map((card) => (
            <Link
              key={card.eyebrow}
              to={card.to}
              className={`dashboard-action-card dashboard-action-card--${card.tone} ${card.pulse ? 'is-pulsing' : ''}`.trim()}
              aria-label={card.ariaLabel}
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

      <section className="dashboard-secondary-grid" aria-label={isZh ? '辅助信息区' : 'Secondary dashboard details'}>
        <Card title={isZh ? '角色聚焦' : 'Role focus'} className="dashboard-secondary-card dashboard-secondary-card--role">
          {rolePanel}
        </Card>

        {!isProfileComplete ? (
          <Card title={isZh ? '资料仍待完善' : 'Profile still incomplete'} className="dashboard-secondary-card dashboard-secondary-card--notice">
            <p>
              {isZh
                ? '补全身高、体重、生日和攀岩经验后，系统推荐会更准确。'
                : 'Complete your height, weight, birthday, and climbing experience for more accurate recommendations.'}
            </p>
            <Link className="text-link" to={routes.profileEdit}>
              {isZh ? '现在去完善' : 'Complete now'}
            </Link>
          </Card>
        ) : (
          <Card title={isZh ? '本周节奏' : 'Weekly rhythm'} className="dashboard-secondary-card dashboard-secondary-card--notice">
            <p>
              {isZh
                ? '保持今天的学习、社交和扫描节奏，Dashboard 会继续把最重要的入口放在前面。'
                : 'Keep your tutorial, community, and scan flow moving. The dashboard will keep the most relevant entry point up front.'}
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
