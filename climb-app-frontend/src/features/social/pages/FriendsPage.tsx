import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import SuccessBanner from '../../../shared/components/feedback/SuccessBanner';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import SocialEmptyState from '../components/SocialEmptyState';
import { useFriends } from '../hooks/useFriends';
import { useRooms } from '../hooks/useRooms';

function buildNamedFeedback(language: 'en' | 'zh', prefix: string, name: string) {
  return language === 'zh' ? `${prefix}${name}。` : `${prefix} ${name}.`;
}

export default function FriendsPage() {
  usePageTitle('Friends');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const {
    friends,
    incoming,
    outgoing,
    suggestions,
    sendRequest,
    respondToRequest,
    cancelRequest,
    removeFriend,
  } = useFriends();
  const { createRoom, inviteFriend } = useRooms();
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const pendingIncoming = incoming.filter((request) => request.status === 'pending');
  const pendingOutgoing = outgoing.filter((request) => request.status === 'pending');
  const historyItems = [
    ...outgoing.filter((request) => request.status !== 'pending'),
    ...incoming.filter((request) => request.status !== 'pending'),
  ];

  async function handleSendRequest(targetUserId: string, username: string) {
    setError('');
    try {
      await sendRequest(targetUserId);
      setFeedback(buildNamedFeedback(language, t('Friend request sent to'), username));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to send request.'));
    }
  }

  async function handleRespond(requestId: string, action: 'accepted' | 'rejected') {
    setError('');
    try {
      await respondToRequest(requestId, action);
      setFeedback(action === 'accepted' ? t('Friend request accepted.') : t('Friend request rejected.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to update friend request.'));
    }
  }

  async function handleCancelRequest(requestId: string, username: string) {
    setError('');
    try {
      await cancelRequest(requestId);
      setFeedback(buildNamedFeedback(language, t('Friend request cancelled for'), username));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to cancel friend request.'));
    }
  }

  async function handleRemoveFriend(friendUserId: string, friendName: string) {
    setError('');
    try {
      await removeFriend(friendUserId);
      setFeedback(buildNamedFeedback(language, t('Friend removed:'), friendName));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to remove friend.'));
    }
  }

  async function handleCreateTeamRoom(friendUserId: string, friendName: string, gymName?: string, region?: string) {
    if (!user) return;

    setError('');
    try {
      const room = await createRoom({
        title: `${user.username} and ${friendName} practice room`,
        gymName: gymName || 'XJTLU Indoor Wall',
        region: region || 'Suzhou',
        description: `A small practice room for ${user.username} and ${friendName} to plan a session, ask for help, and coordinate climbing together.`,
      });

      if (!room) {
        setError(t('Unable to create a team room.'));
        return;
      }

      await inviteFriend(room.id, friendUserId);
      setFeedback(buildNamedFeedback(language, t('Team room created and invitation sent to'), friendName));
      navigate(`${routes.socialRooms}/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unable to create a team room.'));
    }
  }

  return (
    <section className="stack-lg">
      <div className="page-card stack-md">
        <div className="stack-sm">
          <p className="subtle-text">{t('Friends and climbing partners')}</p>
          <h1>{t('Friend network')}</h1>
          <p>
            {t('Build your climbing circle, manage friend requests, and use friends as the base for room invites and practice groups.')}
          </p>
        </div>
        <div className="inline-actions wrap">
          <Link to={routes.socialRooms}><Button>{t('Open climbing rooms')}</Button></Link>
          <Link to={routes.socialFeed}><Button variant="secondary">{t('Back to feed')}</Button></Link>
        </div>
        {feedback ? <SuccessBanner message={feedback} /> : null}
        {error ? <ErrorState message={error} /> : null}
      </div>

      <div className="grid-3">
        <Card title={t('Friends')}>
          <p><strong>{friends.length}</strong> {t('accepted')}</p>
        </Card>
        <Card title={t('Incoming requests')}>
          <p><strong>{pendingIncoming.length}</strong> {t('pending')}</p>
        </Card>
        <Card title={t('Outgoing requests')}>
          <p><strong>{pendingOutgoing.length}</strong> {t('pending')}</p>
        </Card>
      </div>

      <Card title={t('Pending requests to you')}>
        {pendingIncoming.length ? (
          <div className="stack-md">
            {pendingIncoming.map((request) => (
              <div key={request.id} className="list-item stack-sm">
                <strong>{request.fromUserName}</strong>
                <p>{t('Sent a friend request.')}</p>
                <div className="inline-actions wrap">
                  <Button onClick={() => void handleRespond(request.id, 'accepted')}>{t('Accept')}</Button>
                  <Button variant="secondary" onClick={() => void handleRespond(request.id, 'rejected')}>
                    {t('Reject')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SocialEmptyState
            title={t('No pending requests')}
            body={t('When someone adds you, the request will appear here.')}
            pose="tilt"
          />
        )}
      </Card>

      <Card title={t('Pending requests from you')}>
        {pendingOutgoing.length ? (
          <div className="stack-md">
            {pendingOutgoing.map((request) => (
              <div key={request.id} className="list-item stack-sm">
                <strong>{request.toUserName}</strong>
                <p>{t('Waiting for response.')}</p>
                <div className="inline-actions wrap">
                  <Badge>{t('Pending')}</Badge>
                  <Button variant="secondary" onClick={() => void handleCancelRequest(request.id, request.toUserName)}>
                    {t('Cancel request')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SocialEmptyState
            title={t('No outgoing requests')}
            body={t('Requests you send will stay here until the other user responds.')}
            pose="tilt"
          />
        )}
      </Card>

      <Card title={t('Your friends')}>
        {friends.length ? (
          <div className="stack-md">
            {friends.map((friend) => (
              <div key={friend.userId} className="list-item stack-sm">
                <strong>{friend.username}</strong>
                <p>{t(getRoleLabel(friend.role))} | {friend.homeGym || t('Gym not set')} | {friend.region || t('Region not set')}</p>
                {friend.accessibilityNeeds ? <Badge>{t(friend.accessibilityNeeds)}</Badge> : null}
                <div className="inline-actions wrap">
                  <Link to={routes.socialRooms}><Button variant="secondary">{t('Invite via room')}</Button></Link>
                  <Button
                    onClick={() =>
                      void handleCreateTeamRoom(
                        friend.userId,
                        friend.username,
                        friend.homeGym,
                        friend.region,
                      )
                    }
                  >
                    {t('Start team room')}
                  </Button>
                  <Button variant="ghost" onClick={() => void handleRemoveFriend(friend.userId, friend.username)}>
                    {t('Remove friend')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SocialEmptyState
            title={t('No friends yet')}
            body={t('Accept a request or send one to start building your climbing network.')}
            pose="nod"
          />
        )}
      </Card>

      <Card title={t('Discover climbers')}>
        {suggestions.length ? (
          <div className="stack-md">
            {suggestions.map((candidate) => (
              <div key={candidate.userId} className="list-item stack-sm">
                <strong>{candidate.username}</strong>
                <p>{t(getRoleLabel(candidate.role))} | {candidate.homeGym || t('Gym not set')} | {candidate.region || t('Region not set')}</p>
                <Button onClick={() => void handleSendRequest(candidate.userId, candidate.username)}>
                  {t('Add friend')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <SocialEmptyState
            title={t('No suggestions')}
            body={t('Everyone in the current frontend demo is already connected or has a request in progress.')}
            pose="tilt"
          />
        )}
      </Card>

      <Card title={t('Request history')}>
        {historyItems.length ? (
          <div className="stack-md">
            {historyItems.map((request) => (
              <div key={request.id} className="list-item stack-sm">
                <strong>{request.fromUserName} to {request.toUserName}</strong>
                <p>{t('Status:')} {t(request.status)}</p>
              </div>
            ))}
          </div>
        ) : (
          <SocialEmptyState
            title={t('No request history')}
            body={t('Friend request decisions will appear here.')}
            pose="tilt"
          />
        )}
      </Card>
    </section>
  );
}
