import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Button from '../../../shared/components/ui/Button';
import FocusTrap from '../../../shared/components/accessibility/FocusTrap';
import type { AppNotification } from '../hooks/useNotifications';

interface NotificationDrawerProps {
  open: boolean;
  notifications: AppNotification[];
  onOpenItem: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
  labelledById?: string;
  drawerId?: string;
}

export default function NotificationDrawer({
  open,
  notifications,
  onOpenItem,
  onMarkAllRead,
  onClose,
  labelledById,
  drawerId,
}: NotificationDrawerProps) {
  const { t } = useLanguage();
  const fallbackTitleId = useId();
  const titleId = labelledById ?? fallbackTitleId;
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  if (!open) return null;

  return (
    <FocusTrap
      active={open}
      className="page-card stack-sm notification-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      id={drawerId}
      onEscape={onClose}
    >
      <div className="inline-actions wrap notification-drawer-header">
        <h2 id={titleId}>{t('Notifications')}</h2>
        <div className="inline-actions wrap notification-drawer-actions">
          {unreadCount ? (
            <Button variant="ghost" onClick={onMarkAllRead}>
              {t('Mark all read')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} aria-label={t('Close notifications')}>
            {t('Close')}
          </Button>
        </div>
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
    </FocusTrap>
  );
}
