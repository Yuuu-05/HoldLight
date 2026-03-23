import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import SuccessBanner from '../../../shared/components/feedback/SuccessBanner';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { formatDate } from '../../../shared/utils/formatDate';
import SocialEmptyState from '../components/SocialEmptyState';
import SocialStickyHeader from '../components/SocialStickyHeader';
import { useRooms } from '../hooks/useRooms';

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function RoomsPage() {
  usePageTitle('Climbing rooms');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { rooms, invitations, unreadRoomIds, createRoom, joinRoom, respondToInvitation } = useRooms();
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [gymName, setGymName] = useState('');
  const [region, setRegion] = useState('');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) =>
        `${room.title} ${room.gymName} ${room.region} ${room.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [rooms, search],
  );

  async function handleCreateRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const room = await createRoom({
      title,
      gymName,
      region,
      description,
    });
    if (!room) {
      setError(t('Unable to create room.'));
      return;
    }
    setFeedback(t('Climbing room created successfully.'));
    navigate(`${routes.socialRooms}/${room.id}`);
  }

  async function handleJoin(roomId: string, roomName: string) {
    setError('');
    await joinRoom(roomId);
    setFeedback(`${t('Joined')} ${roomName}`);
  }

  async function handleInvitation(roomId: string, invitationId: string, roomName: string, status: 'accepted' | 'declined') {
    setError('');
    const updated = await respondToInvitation(roomId, invitationId, status);
    if (updated) {
      setFeedback(status === 'accepted' ? `${t('Joined')} ${roomName}` : `${roomName} ${t('Declined')}`);
    }
  }

  const pendingInvites = invitations.filter((invite) => invite.status === 'pending');

  return (
    <section className="social-shell stack-lg">
      <SocialStickyHeader
        activeTab="rooms"
        search={search}
        onSearchChange={setSearch}
        placeholder={language === 'zh' ? '搜索岩馆、房间或地区...' : 'Search gyms, rooms, or nearby regions...'}
        eyebrow="Cozy Basecamp"
        title={t('Climbing rooms')}
        description="A softer room hub for gym meetups, route planning, and lightweight climbing groups."
      />

      {feedback ? <SuccessBanner message={feedback} /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="social-room-top-grid">
        <Card title={t('Create a climbing room')} className="social-room-compose-card">
          <form className="stack-md" onSubmit={handleCreateRoom}>
            <Input label={t('Room title')} value={title} onChange={(event) => setTitle(event.target.value)} required />
            <Input label={t('Climbing gym')} value={gymName} onChange={(event) => setGymName(event.target.value)} required />
            <Input label={t('Region / city')} value={region} onChange={(event) => setRegion(event.target.value)} required />
            <Textarea
              label={t('Room description')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder={t('Who is this room for? What kind of practice, help, or meetup are you organizing?')}
              required
            />
            <Button type="submit">{t('Create room')}</Button>
          </form>
        </Card>

        {pendingInvites.length ? (
          <Card title={t('Pending room invitations')} className="social-room-invite-card">
            <div className="social-note-board">
              {pendingInvites.map((invite) => (
                <article key={invite.id} className="intent-note intent-note-pending">
                  <span className="intent-note-pin" aria-hidden="true" />
                  <p className="social-eyebrow">{t('Pending invitation')}</p>
                  <h3>{invite.roomName}</h3>
                  <p>{invite.invitedByName} {t('invited you to join this room.')}</p>
                  <div className="inline-actions wrap">
                    <Button onClick={() => void handleInvitation(invite.roomId, invite.id, invite.roomName, 'accepted')}>
                      {t('Accept invite')}
                    </Button>
                    <Button variant="secondary" onClick={() => void handleInvitation(invite.roomId, invite.id, invite.roomName, 'declined')}>
                      {t('Decline')}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        ) : (
          <article className="social-featured-card social-featured-card-rooms">
            <div className="social-featured-copy stack-md">
              <div className="stack-sm">
                <span className="social-featured-kicker">Room pulse</span>
                <h2>Find a climbing corner that feels right.</h2>
                <p>Search by gym or city, then step into a room built for route notes, meetup planning, and low-pressure help.</p>
              </div>
              <div className="social-featured-footer">
                <div className="inline-actions wrap">
                  <span className="social-mini-pill">{rooms.length} {t(rooms.length === 1 ? 'room' : 'rooms')}</span>
                  <span className="social-mini-pill">{unreadRoomIds.length} unread</span>
                </div>
                <Link className="social-featured-link" to={routes.socialFriends}>{t('Open friends')}</Link>
              </div>
            </div>
            <div className="social-featured-illustration">
              <span className="social-featured-note">Monkey is keeping the lantern on for late arrivals.</span>
              <GuideMascot className="social-featured-mascot" pose="nod" />
            </div>
          </article>
        )}
      </div>

      {filteredRooms.length ? (
        <div className="social-room-grid">
          {filteredRooms.map((room) => {
            const userId = user?._id || user?.id || user?.email || '';
            const isMember = room.members.some((member) => member.userId === userId);
            const unread = unreadRoomIds.includes(room.id);
            const pendingCount = room.invitations.filter((invite) => invite.status === 'pending').length;

            return (
              <Card key={room.id} title={room.title} className="social-room-card">
                <div className="social-room-card-head">
                  <div className="stack-sm">
                    <strong>{room.gymName}</strong>
                    <p className="subtle-text">{room.region}</p>
                  </div>
                  <div className="social-room-avatar-stack" aria-hidden="true">
                    {room.members.slice(0, 4).map((member) => (
                      <span key={member.userId} className="social-avatar-bubble">{getInitials(member.userName)}</span>
                    ))}
                  </div>
                </div>
                <p>{room.description}</p>
                <div className="inline-actions wrap">
                  {isMember ? <Badge>{t('Joined')}</Badge> : null}
                  {unread ? <Badge>{t('Unread messages')}</Badge> : null}
                  {pendingCount ? <Badge>{pendingCount} {t(pendingCount === 1 ? 'pending invite' : 'pending invites')}</Badge> : null}
                </div>
                <p className="subtle-text">
                  {room.members.length} {t(room.members.length === 1 ? 'member' : 'members')} • {formatDate(room.createdAt)}
                </p>
                <div className="inline-actions wrap">
                  <Link to={`${routes.socialRooms}/${room.id}`}>
                    <Button variant="secondary">{t('Open room')}</Button>
                  </Link>
                  {!isMember ? <Button onClick={() => void handleJoin(room.id, room.title)}>{t('Join room')}</Button> : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <SocialEmptyState
          title={t('No rooms found')}
          body={t('Try another gym or create a new room for your climbing hall.')}
          action={<Link className="social-featured-link" to={routes.socialFeed}>{t('Back to feed')}</Link>}
          pose="tilt"
        />
      )}
    </section>
  );
}
