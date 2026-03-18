import { useAuth } from '../../../app/providers/AuthProvider';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import EmptyState from '../../../shared/components/feedback/EmptyState';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import SuccessBanner from '../../../shared/components/feedback/SuccessBanner';
import { routes } from '../../../shared/constants/routes';
import { formatDate } from '../../../shared/utils/formatDate';
import { useRooms } from '../hooks/useRooms';
import Badge from '../../../shared/components/ui/Badge';

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
    setFeedback(language === 'zh' ? `${t('Joined')} ${roomName}。` : `${t('Joined')} ${roomName}.`);
  }

  return (
    <section className="stack-lg">
      <div className="page-card stack-md">
        <div className="stack-sm">
          <p className="subtle-text">{t('Climbing rooms by gym and region')}</p>
          <h1>{t('Climbing rooms')}</h1>
          <p>
            {t('Create a room for a climbing gym, invite friends, search rooms by location, and use the room as a social space for chat, help, and practice planning.')}
          </p>
        </div>
        <div className="inline-actions wrap">
          <Link to={routes.socialFriends}><Button>{t('Open friends')}</Button></Link>
          <Link to={routes.socialFeed}><Button variant="secondary">{t('Back to feed')}</Button></Link>
        </div>
        {feedback ? <SuccessBanner message={feedback} /> : null}
        {error ? <ErrorState message={error} /> : null}
      </div>

      <Card title={t('Create a climbing room')}>
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

      <Card title={t('Pending room invitations')}>
        {invitations.filter((invite) => invite.status === 'pending').length ? (
          <div className="stack-md">
            {invitations
              .filter((invite) => invite.status === 'pending')
              .map((invite) => (
                <div key={invite.id} className="list-item stack-sm">
                  <div className="inline-actions wrap">
                    <strong>{invite.roomName}</strong>
                    <Badge>{t('Pending invitation')}</Badge>
                  </div>
                  <p>{invite.invitedByName} {t('invited you to join this room.')}</p>
                  <div className="inline-actions wrap">
                    <Button onClick={() => void respondToInvitation(invite.roomId, invite.id, 'accepted')}>
                      {t('Accept invite')}
                    </Button>
                    <Button variant="secondary" onClick={() => void respondToInvitation(invite.roomId, invite.id, 'declined')}>
                      {t('Decline')}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <EmptyState title={t('No room invitations')} body={t('Friend room invites will appear here.')} />
        )}
      </Card>

      <Card title={t('Search rooms')}>
        <Input label={t('Search by gym, room, or region')} value={search} onChange={(event) => setSearch(event.target.value)} />
      </Card>

      <div className="stack-lg">
        {filteredRooms.length ? (
          filteredRooms.map((room) => {
            const userId = user?._id || user?.id || user?.email || '';
            const isMember = room.members.some((member) => member.userId === userId);
            const unread = unreadRoomIds.includes(room.id);
            const pendingCount = room.invitations.filter((invite) => invite.status === 'pending').length;
            return (
              <Card key={room.id} title={room.title}>
                <p>{room.description}</p>
                <p><strong>{t('Gym:')}</strong> {room.gymName}</p>
                <p><strong>{t('Region:')}</strong> {room.region}</p>
                <p><strong>{t('Members:')}</strong> {room.members.length}</p>
                <p><strong>{t('Created:')}</strong> {formatDate(room.createdAt)}</p>
                <div className="inline-actions wrap">
                  {isMember ? <Badge>{t('Joined')}</Badge> : null}
                  {unread ? <Badge>{t('Unread messages')}</Badge> : null}
                  {pendingCount ? <Badge>{pendingCount} {t(pendingCount === 1 ? 'pending invite' : 'pending invites')}</Badge> : null}
                </div>
                <div className="inline-actions wrap">
                  <Link to={`${routes.socialRooms}/${room.id}`}>
                    <Button variant="secondary">{t('Open room')}</Button>
                  </Link>
                  {!isMember ? <Button onClick={() => void handleJoin(room.id, room.title)}>{t('Join room')}</Button> : null}
                </div>
              </Card>
            );
          })
        ) : (
          <EmptyState title={t('No rooms found')} body={t('Try another gym or create a new room for your climbing hall.')} />
        )}
      </div>
    </section>
  );
}
