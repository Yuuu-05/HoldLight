import { useLanguage } from '../../../app/providers/LanguageProvider';

interface SessionStatusBadgeProps {
  count: number;
}

export default function SessionStatusBadge({ count }: SessionStatusBadgeProps) {
  const { t } = useLanguage();

  return (
    <span className="volunteer-state-pill volunteer-state-pill-matched" aria-live="polite" aria-atomic="true">
      <span aria-hidden="true">🤝</span>
      <span>
        {count} {t(count === 1 ? 'volunteer response' : 'volunteer responses')}
      </span>
    </span>
  );
}
