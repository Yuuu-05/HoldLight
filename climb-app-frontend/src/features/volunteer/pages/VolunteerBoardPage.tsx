import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import SocialEmptyState from '../../social/components/SocialEmptyState';
import SocialStickyHeader from '../../social/components/SocialStickyHeader';
import VolunteerCard from '../components/VolunteerCard';
import { useVolunteerBoard } from '../hooks/useVolunteerBoard';

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

export default function VolunteerBoardPage() {
  const [search, setSearch] = useState('');
  const { language, t } = useLanguage();
  const isZh = language === 'zh';
  const { items, myRequests, myInterestedSessions, upcomingSessions } = useVolunteerBoard();
  const navigate = useNavigate();
  usePageTitle(t('Volunteer board'));

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        `${item.title} ${item.location} ${item.notes} ${item.difficulty}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [items, search],
  );

  const featuredNotice = useMemo(() => {
    const matchedRequest = myRequests.find((item) =>
      item.applicants.some((application) => ['accepted', 'completed'].includes(application.status)),
    );
    const matchedApplicant = matchedRequest?.applicants.find((application) =>
      ['accepted', 'completed'].includes(application.status),
    );
    const upcomingSession = upcomingSessions[0];
    const firstOpenRequest = items.find((item) =>
      item.applicants.every((application) => application.status === 'cancelled'),
    );

    if (matchedRequest && matchedApplicant) {
      return {
        tone: 'matched' as const,
        pose: 'celebrate' as const,
        pulse: true,
        kicker: isZh ? '已匹配的支持' : 'Matched support',
        title: isZh
          ? `${matchedApplicant.userName} 已接受你的支持请求`
          : `${matchedApplicant.userName} accepted your support request.`,
        body: isZh
          ? `${matchedRequest.title} 正在继续推进。打开卡片查看下一步安排。`
          : `${matchedRequest.title} is moving forward. Open the card to review the next step.`,
        note: isZh ? '小猴子在旁边轻轻鼓掌。' : 'Monkey is celebrating beside the board.',
      };
    }

    if (upcomingSession) {
      return {
        tone: 'matched' as const,
        pose: 'nod' as const,
        pulse: true,
        kicker: isZh ? '近期安排' : 'Upcoming session',
        title: isZh
          ? `${upcomingSession.title} 已经排进你的日程`
          : `${upcomingSession.title} is already on your schedule.`,
        body: isZh
          ? '这里会安静地提醒你下一次支持或陪练，节奏保持轻柔。'
          : 'This board quietly keeps your next support session in view so the pace stays gentle.',
        note: isZh ? '小猴子已经为下一次安排点亮了灯。' : 'Monkey has lit a lantern for the next session.',
      };
    }

    return {
      tone: 'pending' as const,
      pose: 'tilt' as const,
      pulse: false,
      kicker: isZh ? '营地看板' : 'Board pulse',
      title: isZh
        ? '支持请求会在这里安静地等待接单。'
        : 'Volunteer support is ready whenever you need it.',
      body: isZh
        ? firstOpenRequest
          ? `${firstOpenRequest.title} 正在等待温和的回应。`
          : '新的请求会保持清晰和安静，直到有人回应。'
        : firstOpenRequest
          ? `${firstOpenRequest.title} is waiting for a gentle response.`
          : 'New requests stay warm and visible until a guide responds.',
      note: isZh ? '小猴子在看板旁边放了一张软垫。' : 'Monkey is keeping watch for support requests.',
    };
  }, [isZh, items, myRequests, upcomingSessions]);

  const shortcutItems = [
    {
      to: routes.volunteerCreate,
      label: isZh ? '发起求助' : 'Create request',
      keyLabel: 'Alt+1',
    },
    {
      to: routes.volunteerMySessions,
      label: isZh ? '我的活动' : 'My sessions',
      keyLabel: 'Alt+2',
    },
    {
      to: routes.contactIntent,
      label: isZh ? '联系便签' : 'Contact intents',
      keyLabel: 'Alt+3',
    },
  ];

  const quickActions = [
    {
      to: routes.volunteerCreate,
      tone: 'lavender',
      icon: '🤝',
      title: isZh ? '发起求助' : t('Create request'),
      body: isZh ? '发一条轻松清楚的支持请求，让内容一眼就能看懂。' : 'Post a calm support request for a climbing session or route preview.',
    },
    {
      to: routes.volunteerMySessions,
      tone: 'mint',
      icon: '🗂️',
      title: isZh ? '我的活动' : t('My sessions'),
      body: isZh
        ? `${upcomingSessions.length} 个即将到来的活动`
        : `${upcomingSessions.length} ${t(upcomingSessions.length === 1 ? 'Upcoming session' : 'Upcoming sessions')}`,
    },
    {
      to: routes.contactIntent,
      tone: 'sun',
      icon: '📝',
      title: isZh ? '联系便签' : 'Contact intents',
      body: isZh ? '查看简短回应，不需要变成即时报聊。' : 'Review lightweight replies without the pressure of instant chat.',
    },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (isTextEntryTarget(event.target)) {
        return;
      }

      const routeByShortcut: Record<string, string | null> = {
        1: routes.volunteerCreate,
        2: routes.volunteerMySessions,
        3: routes.contactIntent,
      };

      const nextRoute = routeByShortcut[event.key];
      if (!nextRoute) {
        return;
      }

      event.preventDefault();
      navigate(nextRoute);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <section className="social-shell stack-lg">
      <h1 className="sr-only">{t('Volunteer board')}</h1>

      <SocialStickyHeader
        activeTab="volunteer"
        search={search}
        onSearchChange={setSearch}
        placeholder={isZh ? '搜索支持请求、地点或路线...' : 'Search support requests by place, time, or route...'}
        title={t('Volunteer board')}
        description="Low-pressure support requests, gentle coordination, and a warmer way to ask for help."
      />

      <div className="stack-sm">
        <p className="social-eyebrow">{isZh ? '快捷键' : 'Shortcuts'}</p>
        <div className="social-shortcut-row" aria-label={isZh ? '志愿者快捷键' : 'Volunteer shortcuts'}>
          {shortcutItems.map((item) => (
            <Link
              key={item.to}
              className="social-shortcut-chip"
              to={item.to}
              aria-keyshortcuts={item.keyLabel}
            >
              <span className="social-shortcut-chip-label">{item.label}</span>
              <span className="social-shortcut-chip-key">{item.keyLabel}</span>
            </Link>
          ))}
        </div>
      </div>

      <article className={`social-featured-card social-featured-card-volunteer ${featuredNotice.pulse ? 'is-pulsing' : ''}`.trim()}>
        <div className="social-featured-copy stack-md">
          <div className="stack-sm">
            <span className="social-featured-kicker">{featuredNotice.kicker}</span>
            <h2>{featuredNotice.title}</h2>
            <p>{featuredNotice.body}</p>
          </div>
          <div className="social-featured-footer">
            <div className="inline-actions wrap">
              <span className="social-mini-pill">
                {items.length} {t(items.length === 1 ? 'active request' : 'active requests')}
              </span>
              <span className="social-mini-pill">
                {myRequests.length} {isZh ? '我的请求' : 'my requests'}
              </span>
              <span className="social-mini-pill">
                {myInterestedSessions.length} {isZh ? '已发送回应' : 'replies sent'}
              </span>
            </div>
            <Link className="social-featured-link" to={routes.volunteerCreate}>
              {isZh ? '发起求助' : t('Create request')}
            </Link>
          </div>
        </div>
        <div className="social-featured-illustration">
          <span className="social-featured-note">{featuredNotice.note}</span>
          <GuideMascot className="social-featured-mascot" pose={featuredNotice.pose} />
        </div>
      </article>

      <div className="social-quick-scroll" aria-label={isZh ? '志愿者快捷入口' : 'Volunteer quick actions'}>
        {quickActions.map((action) => (
          <Link key={action.to} className={`social-quick-card social-quick-card-${action.tone}`} to={action.to}>
            <span className="social-quick-icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="social-quick-kicker">{isZh ? '快捷入口' : 'Volunteer hub'}</span>
            <strong className="social-quick-title">{action.title}</strong>
            <p>{action.body}</p>
          </Link>
        ))}
      </div>

      {filteredItems.length ? (
        <div className="social-request-grid">
          {filteredItems.map((item) => (
            <VolunteerCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <SocialEmptyState
          title={
            isZh
              ? '没有找到匹配的志愿者便签。'
              : 'No volunteer notes match this search.'
          }
          body={
            isZh
              ? '换一个地点或时间再试，或者直接发布一条新的支持请求。'
              : 'Try another place or time, or publish a support request to start the board yourself.'
          }
          action={<Link className="social-featured-link" to={routes.volunteerCreate}>{isZh ? '发起求助' : t('Create request')}</Link>}
          pose="nod"
        />
      )}
    </section>
  );
}
