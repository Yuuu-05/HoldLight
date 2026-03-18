import Badge from '../../../shared/components/ui/Badge';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface SessionStatusBadgeProps {
  count: number;
}

export default function SessionStatusBadge({ count }: SessionStatusBadgeProps) {
  const { t } = useLanguage();
  return <Badge>{count} {t(count === 1 ? 'volunteer response' : 'volunteer responses')}</Badge>;
}
