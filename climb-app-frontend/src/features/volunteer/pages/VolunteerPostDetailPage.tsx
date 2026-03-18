import { useCallback, useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import {
  applyVolunteerIntentApi,
  cancelVolunteerApplicationApi,
  getVolunteerPostByIdApi,
  updateVolunteerApplicationStatusApi,
} from '../../../shared/api/volunteers.api';
import type { VolunteerApplication, VolunteerPostItem } from '../../../shared/types/volunteer';
import Card from '../../../shared/components/ui/Card';
import ApplyVolunteerButton from '../components/ApplyVolunteerButton';
import ContactIntentModal from '../components/ContactIntentModal';
import SessionStatusBadge from '../components/SessionStatusBadge';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Link } from 'react-router-dom';
import { routes } from '../../../shared/constants/routes';
import Button from '../../../shared/components/ui/Button';
import { getUserId } from '../../../shared/types/user';
import { formatDate } from '../../../shared/utils/formatDate';

export default function VolunteerPostDetailPage() {
  const { postId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [item, setItem] = useState<VolunteerPostItem | null>(null);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const currentUserId = getUserId(user);
  const loadPost = useCallback(async () => {
    if (!postId) return;
    const nextItem = await getVolunteerPostByIdApi(postId);
    setItem(nextItem);
  }, [postId]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  if (!item) return <Card title={t('Volunteer request')}><p>{t('Request not found.')}</p></Card>;

  const isAuthor = currentUserId === item.authorId;
  const currentApplication = item.applicants.find((application) => application.userId === currentUserId) ?? null;
  const activeApplicants = item.applicants.filter((application) => application.status !== 'cancelled');
  const canApply = Boolean(user && !isAuthor && !currentApplication);

  const handleApplicationUpdate = async (
    application: VolunteerApplication,
    nextStatus: 'accepted' | 'completed' | 'cancelled',
  ) => {
    setActionLoadingId(application.id);
    setFeedback(null);

    try {
      const updated =
        nextStatus === 'cancelled'
          ? await cancelVolunteerApplicationApi(item.id, application.id)
          : await updateVolunteerApplicationStatusApi(item.id, application.id, nextStatus);

      if (updated) {
        setItem(updated);
        setFeedback({
          type: 'success',
          message: t('Volunteer application updated.'),
        });
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : t('Unable to update volunteer request.'),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const actionMap = useMemo(
    () =>
      item.applicants.map((application) => {
        const actions: Array<{
          key: string;
          label: string;
          variant?: 'primary' | 'secondary' | 'danger';
          status: 'accepted' | 'completed' | 'cancelled';
        }> = [];

        if (isAuthor && application.status === 'interested') {
          actions.push({
            key: `${application.id}:accepted`,
            label: t('Accept volunteer'),
            variant: 'primary',
            status: 'accepted',
          });
        }

        if ((isAuthor || application.userId === currentUserId) && application.status === 'accepted') {
          actions.push({
            key: `${application.id}:completed`,
            label: t('Complete session'),
            variant: 'secondary',
            status: 'completed',
          });
        }

        if ((isAuthor || application.userId === currentUserId) && ['interested', 'accepted'].includes(application.status)) {
          actions.push({
            key: `${application.id}:cancelled`,
            label: t('Cancel application'),
            variant: 'danger',
            status: 'cancelled',
          });
        }

        return {
          applicationId: application.id,
          actions,
        };
      }),
    [currentUserId, isAuthor, item.applicants, t],
  );

  return (
    <Card title={item.title} actions={<SessionStatusBadge count={activeApplicants.length} />}>
      {feedback ? (
        <div className={feedback.type === 'success' ? 'success-banner' : 'error-banner'}>
          {feedback.message}
        </div>
      ) : null}
      <p>{item.notes}</p>
      <p><strong>{t('Location')}:</strong> {item.location}</p>
      <p><strong>{t('Session time')}:</strong> {formatDate(item.sessionTime)}</p>
      <p><strong>{t('Difficulty')}:</strong> {item.difficulty}</p>
      {currentApplication ? (
        <div className="list-item stack-sm">
          <strong>{t('Your status:')}</strong>
          <p>{t(currentApplication.status)}</p>
          <p className="subtle-text">{currentApplication.message}</p>
        </div>
      ) : null}

      <div className="stack-sm">
        <strong>{t('Interested volunteers:')}</strong>
        {item.applicants.length ? (
          <div className="stack-sm">
            {item.applicants.map((application) => {
              const actions = actionMap.find((entry) => entry.applicationId === application.id)?.actions ?? [];
              return (
                <div key={application.id} className="list-item stack-sm">
                  <div className="inline-actions wrap">
                    <strong>{application.userName}</strong>
                    <span className="subtle-text">{t('Status:')} {t(application.status)}</span>
                  </div>
                  <p>{application.message}</p>
                  <p className="subtle-text">
                    {t('Sent on')} {formatDate(application.createdAt)}
                  </p>
                  {actions.length ? (
                    <div className="inline-actions wrap">
                      {actions.map((action) => (
                        <Button
                          key={action.key}
                          variant={action.variant}
                          onClick={() => void handleApplicationUpdate(application, action.status)}
                          disabled={actionLoadingId === application.id}
                        >
                          {actionLoadingId === application.id ? t('Saving...') : action.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="subtle-text">{t('No volunteer applications yet.')}</p>
        )}
      </div>

      {canApply ? <ApplyVolunteerButton onClick={() => setOpen(true)} /> : null}
      <Link className="text-link" to={routes.contactIntent}>
        {t('View all contact intents')}
      </Link>
      <ContactIntentModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (message) => {
          if (!user) return;
          const updated = await applyVolunteerIntentApi(item.id, {
            userId: user._id || user.id || user.email,
            userName: user.username,
            message,
          });
          if (updated) {
            setItem(updated);
            setOpen(false);
            setFeedback({
              type: 'success',
              message: t('Volunteer application submitted.'),
            });
          }
        }}
      />
    </Card>
  );
}
