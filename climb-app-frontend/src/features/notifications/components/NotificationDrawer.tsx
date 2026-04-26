import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Button from '../../../shared/components/ui/Button';
import type { AppNotification } from '../hooks/useNotifications';

interface NotificationDrawerProps {
  open: boolean;
  notifications: AppNotification[];
  onOpenItem: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationDrawer({
  open,
  notifications,
  onOpenItem,
  onMarkAllRead,
}: NotificationDrawerProps) {
  const { t } = useLanguage();
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  if (!open) return null;

  return (
    <div className="page-card stack-sm notification-drawer" role="dialog" aria-label={t('Notifications')}>
      <div className="inline-actions wrap">
        <h2>{t('Notifications')}</h2>
        {unreadCount ? (
          <Button variant="ghost" onClick={onMarkAllRead}>
            {t('Mark all read')}
          </Button>
        ) : null}
      </div>
      {notifications.length ? (
        <div className="stack-sm">
          {notifications.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="list-item stack-sm"
              onClick={() => onOpenItem(item.id)}
            >
              <div className="inline-actions wrap">
                <strong>{item.title}</strong>
                <span className="subtle-text">{t(item.isRead ? 'Read' : 'Unread')}</span>
              </div>
              <p>{item.body}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="subtle-text">{t('No notifications right now.')}</p>
      )}
    </div>
  );
}
