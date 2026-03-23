import { useLanguage } from '../../../app/providers/LanguageProvider';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import TransitionLink from '../../../shared/components/layout/TransitionLink';
import { routes } from '../../../shared/constants/routes';
import type { VolunteerPostItem } from '../../../shared/types/volunteer';
import { formatDate } from '../../../shared/utils/formatDate';

interface VolunteerCardProps {
  item: VolunteerPostItem;
}

export default function VolunteerCard({ item }: VolunteerCardProps) {
  const { language, t } = useLanguage();
  const activeApplicants = item.applicants.filter((application) => application.status !== 'cancelled');
  const matchedApplicant = item.applicants.find(
    (application) => application.status === 'accepted' || application.status === 'completed',
  );
  const tone = matchedApplicant ? 'matched' : 'pending';
  const authorInitials = item.authorName.slice(0, 2).toUpperCase();

  return (
    <Card
      title={item.title}
      actions={(
        <span className={`volunteer-state-pill volunteer-state-pill-${tone}`.trim()} aria-live="polite" aria-atomic="true">
          <span aria-hidden="true">{matchedApplicant ? '🤝' : '⏳'}</span>
          <span>
            {matchedApplicant
              ? language === 'zh'
                ? '已匹配'
                : 'Matched support'
              : language === 'zh'
                ? '等待接单'
                : 'Waiting for volunteer'}
          </span>
        </span>
      )}
      className={`community-volunteer-card volunteer-tone-${tone}`.trim()}
      bodyClassName="community-volunteer-card-body stack-md"
      style={{ viewTransitionName: `volunteer-card-${item.id}` }}
    >
      <div className="volunteer-card-owner">
        <div className="community-avatar-badge" aria-hidden="true">
          {authorInitials}
        </div>
        <div className="volunteer-card-owner-copy stack-sm">
          <strong>{item.authorName}</strong>
          <p className="subtle-text">
            {matchedApplicant
              ? language === 'zh'
                ? '已和志愿者温和匹配。'
                : 'Session paired with a guide.'
              : language === 'zh'
                ? '在志愿者公告板里继续查看。'
                : 'Open request inside the volunteer board.'}
          </p>
        </div>
      </div>

      <p className="volunteer-card-notes">{item.notes}</p>

      <p className="volunteer-card-meta">
        <span>
          <strong>{t('Location')}:</strong> {item.location}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <strong>{t('Time')}:</strong> {formatDate(item.sessionTime)}
        </span>
      </p>

      <div className="inline-actions wrap volunteer-card-chips">
        <Badge>{item.difficulty}</Badge>
        <span className="social-mini-pill">
          {activeApplicants.length} {t(activeApplicants.length === 1 ? 'volunteer response' : 'volunteer responses')}
        </span>
      </div>

      <TransitionLink className="social-inline-link" to={routes.volunteerPostDetail(item.id)}>
        {t('View request')}
      </TransitionLink>
    </Card>
  );
}
