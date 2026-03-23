import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import SuccessBanner from '../../../shared/components/feedback/SuccessBanner';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { getRoomByIdApi } from '../../../shared/api/rooms.api';
import { routes } from '../../../shared/constants/routes';
import type { ClimbingRoom } from '../../../shared/types/room';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import { formatDate } from '../../../shared/utils/formatDate';
import SocialEmptyState from '../components/SocialEmptyState';
import { useFriends } from '../hooks/useFriends';
import { useRooms } from '../hooks/useRooms';

function buildNamedFeedback(prefix: string, name: string) {
  return `${prefix} ${name}`.trim();
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { friends } = useFriends();
  const { joinRoom, inviteFriend, sendMessage, respondToInvitation, withdrawInvitation, markAsRead } = useRooms();
  const [room, setRoom] = useState<ClimbingRoom | null>(null);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const userId = user?._id || user?.id || user?.email || '';
  const isMember = room?.members.some((member) => member.userId === userId) ?? false;
  const pendingInvite = room?.invitations.find(
    (invite) => invite.invitedUserId === userId && invite.status === 'pending',
  );
  const lastReadAt = room?.readStates.find((state) => state.userId === userId)?.lastReadAt ?? '';
  const hasUnreadMessages =
    room?.messages.some((item) => item.userId !== userId && item.createdAt > lastReadAt) ?? false;

  useEffect(() => {
    if (!roomId) return;
    getRoomByIdApi(roomId).then(setRoom);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !isMember || !hasUnreadMessages) return;
    void markAsRead(roomId);
  }, [hasUnreadMessages, isMember, markAsRead, roomId]);

  const invitableFriends = useMemo(
    () =>
      friends.filter((friend) => {
        if (!room) return false;
        if (room.members.some((member) => member.userId === friend.userId)) return false;
        if (room.invitations.some((invite) => invite.invitedUserId === friend.userId && invite.status === 'pending')) return false;
        return true;
      }),
    [friends, room],
  );

  if (!room) {
    return (
      <section className="social-shell stack-lg">
        <SocialEmptyState
          title={t('Climbing room')}
          body={t('Room not found.')}
          action={<Link className="social-featured-link" to={routes.socialRooms}>{t('Back to rooms')}</Link>}
          pose="tilt"
        />
      </section>
    );
  }

  const currentRoom = room;

  async function handleJoin() {
    setError('');
    try {
      const updated = await joinRoom(currentRoom.id);
      if (updated) {
        setRoom(updated);
        setFeedback(t('You joined the room.'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to join room.'));
    }
  }

  async function handleInvite(friendUserId: string, friendName: string) {
    setError('');
    try {
      const updated = await inviteFriend(currentRoom.id, friendUserId);
      if (updated) {
        setRoom(updated);
        setFeedback(buildNamedFeedback(t('Invitation sent to'), friendName));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to invite friend.'));
    }
  }

  async function handleWithdrawInvitation(invitationId: string, friendName: string) {
    setError('');
    try {
      const updated = await withdrawInvitation(currentRoom.id, invitationId);
      if (updated) {
        setRoom(updated);
        setFeedback(buildNamedFeedback(t('Invitation withdrawn for'), friendName));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to withdraw invitation.'));
    }
  }

  async function handleSendMessage(type: 'chat' | 'help' | 'plan' = 'chat') {
    if (!message.trim()) {
      setError(t('Enter a message before sending.'));
      return;
    }

    try {
      const updated = await sendMessage(currentRoom.id, message.trim(), type);
      if (updated) {
        setRoom(updated);
        setMessage('');
        setFeedback(type === 'help' ? t('Help request sent to the room.') : t('Message sent.'));
        setError('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to send message.'));
    }
  }

  async function handleInvitation(status: 'accepted' | 'declined') {
    if (!pendingInvite) return;

    setError('');
    try {
      const updated = await respondToInvitation(currentRoom.id, pendingInvite.id, status);
      if (updated) {
        setRoom(updated);
        setFeedback(status === 'accepted' ? t('Invitation accepted.') : t('Invitation declined.'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to respond to invitation.'));
    }
  }

  return (
    <section className="social-shell stack-lg">
      <div className="social-room-detail-hero">
        <div className="social-room-cover">
          <span className="social-room-cover-badge social-mini-pill">{currentRoom.gymName}</span>
          <span className="social-featured-note social-room-cover-note">Monkey is guarding the warm-up corner.</span>
          <GuideMascot className="social-room-cover-mascot" pose={isMember ? 'nod' : 'tilt'} />
        </div>

        <div className="social-room-detail-panel stack-md">
          <div className="stack-sm">
            <p className="social-eyebrow">Room detail</p>
            <h1>{currentRoom.title}</h1>
            <p>{currentRoom.description}</p>
          </div>

          <div className="inline-actions wrap">
            <Badge>{currentRoom.gymName}</Badge>
            <Badge>{currentRoom.region}</Badge>
            <Badge>{currentRoom.members.length} {t(currentRoom.members.length === 1 ? 'member' : 'members')}</Badge>
          </div>

          <div className="social-room-member-strip">
            <div className="social-room-avatar-stack" aria-hidden="true">
              {currentRoom.members.slice(0, 5).map((member) => (
                <span key={member.userId} className="social-avatar-bubble">{getInitials(member.userName)}</span>
              ))}
            </div>
            <p className="subtle-text">{hasUnreadMessages ? t('Unread messages') : t('All messages read')}</p>
          </div>

          <div className="inline-actions wrap">
            <Link to={routes.socialRooms}><Button variant="ghost">{t('Back to rooms')}</Button></Link>
            {!isMember ? <Button onClick={() => void handleJoin()}>{t('Join room')}</Button> : null}
          </div>

          {pendingInvite ? (
            <div className="inline-actions wrap">
              <Badge>{t('Invitation pending your response')}</Badge>
              <Button onClick={() => void handleInvitation('accepted')}>{t('Accept invitation')}</Button>
              <Button variant="secondary" onClick={() => void handleInvitation('declined')}>{t('Decline invitation')}</Button>
            </div>
          ) : null}

          {feedback ? <SuccessBanner message={feedback} /> : null}
          {error ? <ErrorState message={error} /> : null}
        </div>
      </div>

      <div className="grid-2 social-room-detail-grid">
        <Card title={t('Members')} className="social-room-member-card">
          <div className="stack-sm">
            {currentRoom.members.map((member) => (
              <div key={member.userId} className="social-member-row">
                <div className="social-avatar-bubble" aria-hidden="true">{getInitials(member.userName)}</div>
                <div className="stack-sm social-member-copy">
                  <strong>{member.userName}</strong>
                  <p>{t(getRoleLabel(member.role))}</p>
                  <p className="subtle-text">{t('Joined')} {formatDate(member.joinedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('Invite friends')} className="social-room-invite-card">
          {isMember ? (
            invitableFriends.length ? (
              <div className="social-note-board">
                {invitableFriends.map((friend) => (
                  <article key={friend.userId} className="intent-note intent-note-request">
                    <span className="intent-note-pin" aria-hidden="true" />
                    <p className="social-eyebrow">{t(getRoleLabel(friend.role))}</p>
                    <h3>{friend.username}</h3>
                    <p>Invite this climber into your room for route planning, help, and meetups.</p>
                    <Button variant="secondary" onClick={() => void handleInvite(friend.userId, friend.username)}>
                      {t('Invite to room')}
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <SocialEmptyState
                title={t('No friends to invite')}
                body={t('Add more friends or switch users in dev mode to test invitations.')}
                action={<Link className="social-featured-link" to={routes.socialFriends}>{t('Open friends')}</Link>}
                pose="tilt"
              />
            )
          ) : (
            <SocialEmptyState
              title={t('Join the room first to invite friends.')}
              body={t('You can enter the room now, then invite people once you are inside.')}
              pose="nod"
            />
          )}
        </Card>
      </div>

      <Card title={t('Invitation status')} className="social-room-status-card">
        {currentRoom.invitations.length ? (
          <div className="social-note-board">
            {currentRoom.invitations.map((invite) => {
              const canWithdraw =
                invite.status === 'pending' &&
                (invite.invitedById === userId || currentRoom.createdById === userId);

              return (
                <article key={invite.id} className={`intent-note intent-note-${invite.status}`.trim()}>
                  <span className="intent-note-pin" aria-hidden="true" />
                  <p className="social-eyebrow">
                    {invite.status === 'pending'
                      ? t('Pending')
                      : invite.status === 'accepted'
                        ? t('Accepted')
                        : t('Declined')}
                  </p>
                  <h3>{invite.invitedUserName}</h3>
                  <p>{t('Invited by')} {invite.invitedByName}</p>
                  <p className="subtle-text">
                    {t('Sent')} {formatDate(invite.createdAt)}
                    {invite.respondedAt ? ` • ${t('Responded')} ${formatDate(invite.respondedAt)}` : ''}
                  </p>
                  {canWithdraw ? (
                    <Button variant="ghost" onClick={() => void handleWithdrawInvitation(invite.id, invite.invitedUserName)}>
                      {t('Withdraw invitation')}
                    </Button>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <SocialEmptyState
            title={t('No invitations yet')}
            body={t('Invite friends into this room to build a climbing group.')}
            pose="tilt"
          />
        )}
      </Card>

      <Card title={t('Room chat')} className="social-room-chat-card">
        {isMember ? (
          <div className="stack-md">
            <div className="inline-actions wrap">
              <Badge>{hasUnreadMessages ? t('Unread messages') : t('All messages read')}</Badge>
              <p className="subtle-text">
                {t('Last read:')} {lastReadAt ? formatDate(lastReadAt) : t('Not recorded yet')}
              </p>
            </div>
            <div className="social-room-chat-list">
              {currentRoom.messages.map((item) => (
                <article key={item.id} className={`room-chat-note room-chat-note-${item.type}`.trim()}>
                  <div className="inline-actions wrap">
                    <strong>{item.userName}</strong>
                    <Badge>{item.type}</Badge>
                  </div>
                  <p>{item.body}</p>
                  <p className="subtle-text">{formatDate(item.createdAt)}</p>
                </article>
              ))}
            </div>

            <Input
              label={t('Message')}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('Say hello, ask for help, or plan a practice session.')}
            />
            <div className="inline-actions wrap">
              <Button onClick={() => void handleSendMessage('chat')}>{t('Send message')}</Button>
              <Button variant="secondary" onClick={() => void handleSendMessage('help')}>
                {t('Ask for help')}
              </Button>
              <Button variant="ghost" onClick={() => void handleSendMessage('plan')}>
                {t('Post practice plan')}
              </Button>
            </div>
          </div>
        ) : (
          <SocialEmptyState
            title={t('Join to chat')}
            body={t('You need to join the room before sending messages or asking for help.')}
            pose="nod"
          />
        )}
      </Card>
    </section>
  );
}
