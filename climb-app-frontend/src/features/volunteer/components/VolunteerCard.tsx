import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Card from '../../../shared/components/ui/Card';
import type { VolunteerPostItem } from '../../../shared/types/volunteer';
import SessionStatusBadge from './SessionStatusBadge';
import { formatDate } from '../../../shared/utils/formatDate';

interface VolunteerCardProps {
  item: VolunteerPostItem;
}

export default function VolunteerCard({ item }: VolunteerCardProps) {
  const { t } = useLanguage();
  const activeApplicants = item.applicants.filter((application) => application.status !== 'cancelled');

  return (
    <Card title={item.title} actions={<SessionStatusBadge count={activeApplicants.length} />}>
      <p>{item.notes}</p>
      <p><strong>{t('Location')}:</strong> {item.location}</p>
      <p><strong>{t('Time')}:</strong> {formatDate(item.sessionTime)}</p>
      <Link className="text-link" to={`/volunteer/${item.id}`}>{t('View request')}</Link>
    </Card>
  );
}
