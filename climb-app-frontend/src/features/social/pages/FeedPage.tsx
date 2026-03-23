import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useVolunteerBoard } from '../../volunteer/hooks/useVolunteerBoard';
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
  const { language, t } = useLanguage();
  const isZh = language === 'zh';
  usePageTitle('Community');

  const filtered = useMemo(
    () =>
      posts.filter((post) =>
        `${post.title} ${post.body} ${post.tags.join(' ')} ${post.authorName}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [posts, search],
  );

  const featuredNotice = useMemo(() => {
    const matchedVolunteer = volunteerItems.find((item) =>
      item.applicants.some((application) => ['accepted', 'completed'].includes(application.status)),
    );
    const pendingInvitation = invitations.find((invite) => invite.status === 'pending');
    const friendRequest = incoming[0];

    if (matchedVolunteer) {
      return {
        tone: 'volunteer',
        pose: 'celebrate' as const,
        kicker: isZh ? '志愿者配对' : 'Volunteer match',
        title: isZh
          ? `${matchedVolunteer.authorName} 已经匹配到支持。`
          : `${matchedVolunteer.authorName} now has a support match.`,
        body: isZh
          ? `${matchedVolunteer.title} 正在继续推进。打开请求看看细节，把这次陪练保持轻松。`
          : `${matchedVolunteer.title} is moving forward. Open the request to confirm details and keep the session calm.`,
        ctaLabel: isZh ? '打开请求' : 'Open requests',
        ctaTo: routes.volunteerPostDetail(matchedVolunteer.id),
        note: isZh ? '小猴子正在旁边轻轻鼓掌。' : 'Monkey is cheering beside the wall.',
        pulse: true,
      };
    }

    if (pendingInvitation) {
      return {
        tone: 'social',
        pose: 'nod' as const,
        kicker: isZh ? '房间邀请' : 'Room invitation',
        title: isZh
          ? `${pendingInvitation.invitedByName} 邀请你加入 ${pendingInvitation.roomName}。`
          : `${pendingInvitation.invitedByName} invited you into ${pendingInvitation.roomName}.`,
        body: isZh
          ? '邀请会安静地停在这里，等你准备好了再回应。'
          : 'Room invites stay lightweight here, so you can accept when ready and keep planning gentle.',
        ctaLabel: isZh ? '打开房间' : 'Open rooms',
        ctaTo: routes.socialRooms,
        note: isZh ? '小猴子帮你留好了一个暖和的位置。' : 'Monkey saved a spot by the campfire.',
        pulse: true,
      };
    }

    if (friendRequest) {
      return {
        tone: 'friend',
        pose: 'nod' as const,
        kicker: isZh ? '好友请求' : 'Friend request',
        title: isZh
          ? `${friendRequest.fromUserName} 想和你一起爬。`
          : `${friendRequest.fromUserName} wants to climb together.`,
        body: isZh
          ? '把回应留在基地营里，轻轻一点就能保持联系。'
          : 'Your basecamp is getting warmer. Open friends to reply and keep your climbing crew close.',
        ctaLabel: isZh ? '好友' : 'Friends',
        ctaTo: routes.socialFriends,
        note: isZh ? '小猴子正在望台上挥手。' : 'Monkey is waving from the lookout point.',
        pulse: false,
      };
    }

    return {
      tone: 'calm',
      pose: 'tilt' as const,
      kicker: isZh ? '基地营安静中' : 'Basecamp is calm',
      title: isZh
        ? '分享一个故事、路线笔记，或者一个轻轻的问题。'
        : 'Share a story, a route note, or a gentle question.',
      body: isZh
        ? '当墙面安静下来时，这里就是你的第一块营地留言板。先发一条短贴，或者去看看附近的房间。'
        : 'When the wall is quiet, the community card becomes your first spark. Start with a short post or look for a room nearby.',
      ctaLabel: isZh ? '发帖子' : 'Create post',
      ctaTo: routes.createPost,
      note: isZh ? '小猴子正在等下一条留言。' : 'Monkey is listening for the next story.',
      pulse: false,
    };
  }, [incoming, invitations, isZh, volunteerItems]);

  const quickActions = [
    {
      to: routes.createPost,
      tone: 'sun',
      icon: '✨',
      title: isZh ? '发帖子' : t('Create post'),
      body: isZh ? '分享路线笔记、提问，或者记录一段开心的练习。' : 'Share a route note, ask a question, or celebrate a session.',
    },
    {
      to: routes.volunteerCreate,
      tone: 'lavender',
      icon: '🤝',
      title: isZh ? '发起求助' : t('Create request'),
      body: isZh ? '轻轻发出支持请求，让志愿者能一眼看懂。' : 'Ask for a guide or offer support without turning it into a cold ticket.',
    },
    {
      to: routes.socialFriends,
      tone: 'mint',
      icon: '🐒',
      title: isZh ? '我的好友' : t('Friends'),
      body: isZh ? `${friends.length} 位好友` : `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`,
    },
  ];

  return (
    <section className="social-shell stack-lg">
      <h1 className="sr-only">{t('Community')}</h1>

      <SocialStickyHeader
        activeTab="feed"
        search={search}
        onSearchChange={setSearch}
        placeholder={isZh ? '搜索岩馆、好友或求助...' : 'Search gyms, friends, or help requests...'}
        eyebrow="Cozy Basecamp"
        title={t('Community')}
        description="A soft social hub for posts, rooms, volunteer care, and climbing updates."
      />

      <div className="social-quick-scroll" aria-label={isZh ? '快捷入口' : 'Social quick actions'}>
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
                {volunteerItems.length} {t(volunteerItems.length === 1 ? 'active request' : 'active requests')}
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

      {filtered.length ? (
        <div className="social-feed-stack">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <SocialEmptyState
          title={isZh ? '这里暂时很安静。' : 'This corner is quiet right now.'}
          body={
            isZh
              ? '试试别的关键词，或者做第一个在这里留言的人。'
              : 'Try another keyword, or be the first climber to leave a note for the rest of basecamp.'
          }
          action={<Link className="social-featured-link" to={routes.createPost}>{isZh ? '发帖子' : t('Create post')}</Link>}
          pose="tilt"
        />
      )}
    </section>
  );
}
