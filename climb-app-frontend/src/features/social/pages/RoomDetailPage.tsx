import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import EmptyState from '../../../shared/components/feedback/EmptyState';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import SuccessBanner from '../../../shared/components/feedback/SuccessBanner';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { getRoomByIdApi } from '../../../shared/api/rooms.api';
import { routes } from '../../../shared/constants/routes';
import type { ClimbingRoom } from '../../../shared/types/room';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import { formatDate } from '../../../shared/utils/formatDate';
import { useFriends } from '../hooks/useFriends';
import { useRooms } from '../hooks/useRooms';

function buildNamedFeedback(language: 'en' | 'zh', prefix: string, name: string) {
  return language === 'zh' ? `${prefix}${name}。` : `${prefix} ${name}.`;
}

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { language, t } = useLanguage();
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
      <Card title={t('Climbing room')}>
        <p>{t('Room not found.')}</p>
      </Card>
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
        setFeedback(buildNamedFeedback(language, t('Invitation sent to'), friendName));
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
        setFeedback(buildNamedFeedback(language, t('Invitation withdrawn for'), friendName));
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
    <section className="stack-lg">
      <div className="page-card stack-md">
        <div className="stack-sm">
          <p className="subtle-text">{t('Gym social space')}</p>
          <h1>{currentRoom.title}</h1>
          <p>{currentRoom.description}</p>
        </div>
        <div className="inline-actions wrap">
          <Badge>{currentRoom.gymName}</Badge>
          <Badge>{currentRoom.region}</Badge>
          <Badge>{language === 'zh' ? `${currentRoom.members.length}${t('members')}` : `${currentRoom.members.length} ${t('members')}`}</Badge>
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

      <div className="grid-2">
        <Card title={t('Members')}>
          <div className="stack-sm">
            {currentRoom.members.map((member) => (
              <div key={member.userId} className="list-item stack-sm">
                <strong>{member.userName}</strong>
                <p>{t(getRoleLabel(member.role))}</p>
                <p className="subtle-text">{t('Joined')} {formatDate(member.joinedAt)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('Invite friends')}>
          {isMember ? (
            invitableFriends.length ? (
              <div className="stack-sm">
                {invitableFriends.map((friend) => (
                  <div key={friend.userId} className="list-item stack-sm">
                    <strong>{friend.username}</strong>
                    <p>{t(getRoleLabel(friend.role))}</p>
                    <Button variant="secondary" onClick={() => void handleInvite(friend.userId, friend.username)}>
                      {t('Invite to room')}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title={t('No friends to invite')} body={t('Add more friends or switch users in dev mode to test invitations.')} />
            )
          ) : (
            <p>{t('Join the room first to invite friends.')}</p>
          )}
        </Card>
      </div>

      <Card title={t('Invitation status')}>
        {currentRoom.invitations.length ? (
          <div className="stack-sm">
            {currentRoom.invitations.map((invite) => {
              const canWithdraw =
                invite.status === 'pending' &&
                (invite.invitedById === userId || currentRoom.createdById === userId);

              return (
                <div key={invite.id} className="list-item stack-sm">
                  <div className="inline-actions wrap">
                    <strong>{invite.invitedUserName}</strong>
                    <Badge>
                      {invite.status === 'pending'
                        ? t('Pending')
                        : invite.status === 'accepted'
                          ? t('Accepted')
                          : t('Declined')}
                    </Badge>
                  </div>
                  <p>{t('Invited by')} {invite.invitedByName}</p>
                  <p className="subtle-text">
                    {t('Sent')} {formatDate(invite.createdAt)}
                    {invite.respondedAt ? ` | ${t('Responded')} ${formatDate(invite.respondedAt)}` : ''}
                  </p>
                  {canWithdraw ? (
                    <div className="inline-actions wrap">
                      <Button variant="ghost" onClick={() => void handleWithdrawInvitation(invite.id, invite.invitedUserName)}>
                        {t('Withdraw invitation')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title={t('No invitations yet')} body={t('Invite friends into this room to build a climbing group.')} />
        )}
      </Card>

      <Card title={t('Room chat')}>
        {isMember ? (
          <div className="stack-md">
            <div className="inline-actions wrap">
              <Badge>{hasUnreadMessages ? t('Unread messages') : t('All messages read')}</Badge>
              <p className="subtle-text">
                {t('Last read:')} {lastReadAt ? formatDate(lastReadAt) : t('Not recorded yet')}
              </p>
            </div>
            <div className="stack-sm">
              {currentRoom.messages.map((item) => (
                <div key={item.id} className="list-item stack-sm">
                  <div className="inline-actions wrap">
                    <strong>{item.userName}</strong>
                    <Badge>{item.type}</Badge>
                  </div>
                  <p>{item.body}</p>
                  <p className="subtle-text">{formatDate(item.createdAt)}</p>
                </div>
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
          <EmptyState title={t('Join to chat')} body={t('You need to join the room before sending messages or asking for help.')} />
        )}
      </Card>
    </section>
  );
}
