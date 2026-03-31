import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useVolunteerBoard } from '../../volunteer/hooks/useVolunteerBoard';
import VolunteerCard from '../../volunteer/components/VolunteerCard';
import PostCard from '../components/PostCard';
import SocialEmptyState from '../components/SocialEmptyState';
import SocialStickyHeader from '../components/SocialStickyHeader';
import { useFeed } from '../hooks/useFeed';
import { useFriends } from '../hooks/useFriends';
import { useRooms } from '../hooks/useRooms';

export default function FeedPage() {
  const { posts } = useFeed();
  const { items: volunteerItems } = useVolunteerBoard();
  const { rooms, invitations } = useRooms();
  const { incoming, friends } = useFriends();
  const [search, setSearch] = useState('');
  const location = useLocation();
  const { language, t } = useLanguage();
  const isZh = language === 'zh';
  const activeTab = location.hash === '#social-volunteer' ? 'volunteer' : 'feed';
  usePageTitle(t('Community'));

  const filteredPosts = useMemo(
    () =>
      posts.filter((post) =>
        `${post.title} ${post.body} ${post.tags.join(' ')} ${post.authorName}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [posts, search],
  );

  const volunteerPreviewItems = useMemo(() => volunteerItems.slice(0, 3), [volunteerItems]);

  useEffect(() => {
    if (location.hash !== '#social-volunteer') {
      return;
    }

    document.getElementById('social-volunteer')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [location.hash]);

  const featuredNotice = useMemo(() => {
    const pendingInvitation = invitations.find((invite) => invite.status === 'pending');
    const friendRequest = incoming[0];

    if (pendingInvitation) {
      return {
        tone: 'social' as const,
        pose: 'nod' as const,
        kicker: isZh ? '房间邀请' : 'Room invitation',
        title: isZh
          ? `${pendingInvitation.invitedByName} 邀请你加入 ${pendingInvitation.roomName}`
          : `${pendingInvitation.invitedByName} invited you into ${pendingInvitation.roomName}.`,
        body: isZh
          ? '邀请会安静地停在这里，等你准备好了再回复。'
          : 'Room invites stay lightweight here, so you can accept when ready and keep planning gentle.',
        ctaLabel: isZh ? '打开房间' : 'Open rooms',
        ctaTo: routes.socialRooms,
        note: isZh ? '小猴子帮你留好了暖和的位置。' : 'Monkey saved a spot by the campfire.',
        pulse: true,
      };
    }

    if (friendRequest) {
      return {
        tone: 'friend' as const,
        pose: 'nod' as const,
        kicker: isZh ? '好友请求' : 'Friend request',
        title: isZh
          ? `${friendRequest.fromUserName} 想和你一起攀爬`
          : `${friendRequest.fromUserName} wants to climb together.`,
        body: isZh
          ? '把回应留在基地营里，不需要急着切到别的聊天。'
          : 'Your basecamp is getting warmer. Open friends to reply and keep your climbing crew close.',
        ctaLabel: isZh ? '好友' : 'Friends',
        ctaTo: routes.socialFriends,
        note: isZh ? '小猴子正在望台上挥手。' : 'Monkey is waving from the lookout point.',
        pulse: false,
      };
    }

    return {
      tone: 'calm' as const,
      pose: 'tilt' as const,
      kicker: isZh ? '基地营安静中' : 'Basecamp is calm',
      title: isZh
        ? '分享一个故事、路线笔记，或者一个轻松的问题。'
        : 'Share a story, a route note, or a gentle question.',
      body: isZh
        ? '当墙面安静下来，这里就是你的第一块留言板。先发一条短贴，或者看看附近的房间。'
        : 'When the wall is quiet, the community card becomes your first spark. Start with a short post or look for a room nearby.',
      ctaLabel: isZh ? '发帖' : 'Create post',
      ctaTo: routes.createPost,
      note: isZh ? '小猴子正在等下一条留言。' : 'Monkey is listening for the next story.',
      pulse: false,
    };
  }, [incoming, invitations, isZh]);

  const quickActions = [
    {
      to: routes.createPost,
      tone: 'sun',
      icon: '✏️',
      title: isZh ? '发帖' : t('Create post'),
      body: isZh ? '分享路线笔记、问题，或者一次开心的练习。' : 'Share a route note, ask a question, or celebrate a session.',
    },
    {
      to: routes.socialRooms,
      tone: 'lavender',
      icon: '🏠',
      title: isZh ? '房间' : t('Rooms'),
      body: isZh ? '打开房间，看看附近的约练和讨论。' : 'Open rooms to plan sessions, meetups, and route notes.',
    },
    {
      to: `${routes.socialFeed}#social-volunteer`,
      tone: 'volunteer',
      icon: 'V',
      title: isZh ? '社区帮忙' : t('Volunteer support inside Social'),
      body: isZh
        ? '发出请求、查看联系意向和我的活动都在这里。'
        : t('Volunteer support is now grouped under Social, so requests, contact intents, and community coordination stay in one place.'),
    },
    {
      to: routes.socialFriends,
      tone: 'mint',
      icon: '👣',
      title: isZh ? '我的好友' : t('Friends'),
      body: isZh ? `${friends.length} 位好友` : `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`,
    },
  ];

  const volunteerShortcuts = [
    {
      to: routes.volunteerCreate,
      label: isZh ? '发起求助' : t('Create request'),
      body: isZh ? '发布一条轻松清楚的支持请求。' : 'Post a calm support request for a climbing session or route preview.',
    },
    {
      to: routes.volunteerMySessions,
      label: isZh ? '我的活动' : t('My sessions'),
      body: isZh ? '查看你创建或参与的支持安排。' : 'Review sessions you created or already expressed interest in.',
    },
    {
      to: routes.contactIntent,
      label: isZh ? '联系便签' : t('Contact intents'),
      body: isZh ? '查看简短回应，不需要变成即时报聊。' : 'Review lightweight replies without the pressure of instant chat.',
    },
  ];

  const volunteerTitle = isZh ? '志愿者支持' : 'Volunteer care';
  const volunteerDescription = isZh
    ? '把发起求助、我的活动和联系便签直接放在社交主页里。'
    : 'Keep requests, sessions, and contact notes inside the social home page.';

  /*
  const volunteerSnapshot = [
    {
      value: volunteerItems.length,
      label: isZh ? '褰撳墠闇€姹? : 'Open requests',
    },
    {
      value: volunteerPreviewItems.length,
      label: isZh ? '棣栭〉棰勮' : 'Preview cards',
    },
    {
      value: volunteerShortcuts.length,
      label: isZh ? '蹇嵎鍏ュ彛' : 'Direct actions',
    },
  ];

  */
  const volunteerSnapshot = [
    {
      value: volunteerItems.length,
      label: 'Open requests',
    },
    {
      value: volunteerPreviewItems.length,
      label: 'Preview cards',
    },
    {
      value: volunteerShortcuts.length,
      label: 'Direct actions',
    },
  ];

  const volunteerSnapshotLabels = ['Open requests', 'Preview cards', 'Direct actions'];

  return (
    <section className="social-shell stack-lg">
      <h1 className="sr-only">{t('Community')}</h1>

      <SocialStickyHeader
        activeTab={activeTab}
        search={search}
        onSearchChange={setSearch}
        placeholder={isZh ? '搜索岩馆、好友或帖子...' : 'Search gyms, friends, or help requests...'}
        title={t('Community')}
        description={undefined}
        showContextNote
      />

      <article className={`social-featured-card social-featured-card-${featuredNotice.tone} ${featuredNotice.pulse ? 'is-pulsing' : ''}`.trim()}>
        <div className="social-featured-copy stack-md">
          <div className="stack-sm">
            <span className="social-featured-kicker">{featuredNotice.kicker}</span>
            <h2>{featuredNotice.title}</h2>
            <p>{featuredNotice.body}</p>
          </div>
          <div className="social-featured-footer">
            <div className="inline-actions wrap">
              <span className="social-mini-pill">
                {posts.length} {t(posts.length === 1 ? 'post' : 'posts')}
              </span>
              <span className="social-mini-pill">
                {rooms.length} {t(rooms.length === 1 ? 'room' : 'rooms')}
              </span>
              <span className="social-mini-pill">
                {friends.length} {t(friends.length === 1 ? 'friend' : 'friends')}
              </span>
            </div>
            <Link className="social-featured-link" to={featuredNotice.ctaTo}>
              {featuredNotice.ctaLabel}
            </Link>
          </div>
        </div>
        <div className="social-featured-illustration">
          <span className="social-featured-note">{featuredNotice.note}</span>
          <GuideMascot className="social-featured-mascot" pose={featuredNotice.pose} />
        </div>
      </article>

      <div className="social-quick-scroll" aria-label={isZh ? '社区快捷入口' : 'Social quick actions'}>
        {quickActions.map((action) => (
          <Link key={action.to} className={`social-quick-card social-quick-card-${action.tone}`} to={action.to}>
            <span className="social-quick-icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="social-quick-kicker">{isZh ? '快捷入口' : 'Quick action'}</span>
            <strong className="social-quick-title">{action.title}</strong>
            <p>{action.body}</p>
          </Link>
        ))}
      </div>

      {filteredPosts.length ? (
        <div className="social-feed-stack">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <SocialEmptyState
          title={isZh ? '这里暂时很安静。' : 'This corner is quiet right now.'}
          body={
            isZh
              ? '试试别的关键词，或者先发一条留言，成为这里的第一位攀爬者。'
              : 'Try another keyword, or be the first climber to leave a note for the rest of basecamp.'
          }
          action={<Link className="social-featured-link" to={routes.createPost}>{isZh ? '发帖' : t('Create post')}</Link>}
          pose="tilt"
        />
      )}

      <article id="social-volunteer" className="social-featured-card social-featured-card-volunteer social-volunteer-anchor">
        <div className="social-featured-copy stack-md">
          <div className="stack-sm">
            <span className="social-featured-kicker">{volunteerTitle}</span>
            <h2>{isZh ? '把志愿者功能留在社交主页里' : 'Keep volunteer support on the social home page'}</h2>
            <p>{volunteerDescription}</p>
          </div>

          <div className="social-shortcut-row" aria-label={isZh ? '志愿者快捷入口' : 'Volunteer shortcuts'}>
            {volunteerShortcuts.map((shortcut) => (
              <Link key={shortcut.to} className="social-shortcut-chip" to={shortcut.to}>
                <span className="social-shortcut-chip-label">{shortcut.label}</span>
                <span className="social-shortcut-chip-key">{isZh ? '打开' : 'Open'}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="social-featured-illustration">
          <span className="social-featured-note">
            {isZh
              ? `当前有 ${volunteerItems.length} 条支持请求。`
              : `${volunteerItems.length} support requests are available right now.`}
          </span>
          <div className="social-featured-stat-grid" aria-hidden="true">
            {volunteerSnapshot.map((metric, index) => (
              <div key={`${metric.value}-${index}`} className="social-featured-stat-card">
                <strong>{metric.value}</strong>
                <span>{volunteerSnapshotLabels[index]}</span>
              </div>
            ))}
          </div>
        </div>
      </article>

      {volunteerPreviewItems.length ? (
        <div className="social-request-grid">
          {volunteerPreviewItems.map((item) => (
            <VolunteerCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <SocialEmptyState
          title={isZh ? '暂无支持请求' : 'No volunteer requests yet'}
          body={
            isZh
              ? '先创建一条支持请求，或者稍后回来看看新的志愿者便签。'
              : 'Create a request first, or come back later to review new volunteer notes.'
          }
          action={<Link className="social-featured-link" to={routes.volunteerCreate}>{isZh ? '发起求助' : t('Create request')}</Link>}
          pose="tilt"
        />
      )}
    </section>
  );
}
