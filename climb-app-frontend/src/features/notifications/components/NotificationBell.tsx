import Button from '../../../shared/components/ui/Button';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface NotificationBellProps {
  count: number;
  open: boolean;
  onClick: () => void;
  drawerId?: string;
}

export default function NotificationBell({ count, open, onClick, drawerId }: NotificationBellProps) {
  const { t } = useLanguage();
  const label = `${t('Notifications')}${count ? ` (${count})` : ''}`;

  return (
    <Button
      variant={open ? 'primary' : 'ghost'}
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={drawerId}
    >
      {label}
    </Button>
  );
}
