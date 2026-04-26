import Button from '../../../shared/components/ui/Button';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface NotificationBellProps {
  count: number;
  open: boolean;
  onClick: () => void;
}

export default function NotificationBell({ count, open, onClick }: NotificationBellProps) {
  const { t } = useLanguage();
  const label = `${t('Notifications')}${count ? ` (${count})` : ''}`;

  return (
    <Button
      variant={open ? 'primary' : 'ghost'}
      className="notification-button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
    >
      {label}
    </Button>
  );
}
