import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import NotificationBell from '../../../features/notifications/components/NotificationBell';
import NotificationDrawer from '../../../features/notifications/components/NotificationDrawer';
import { useNotifications } from '../../../features/notifications/hooks/useNotifications';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../constants/routes';
import Button from '../ui/Button';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(routes.home);
  };

  return (
    <header className="site-header">
      <div>
        <Link to={routes.home} className="brand-mark">{t('HoldLight')}</Link>
      </div>
      <div className="header-actions">
        <LanguageSwitcher />
        {isAuthenticated ? (
          <>
            <span className="header-user">{t('Hi')}, {user?.username}</span>
            <NotificationBell
              count={unreadCount}
              open={drawerOpen}
              onClick={() => setDrawerOpen((prev) => !prev)}
            />
            <Button variant="ghost" onClick={handleLogout}>{t('Logout')}</Button>
          </>
        ) : (
          <>
            <Link className="text-link" to={routes.login}>{t('Login')}</Link>
            <Link className="text-link" to={routes.register}>{t('Register')}</Link>
          </>
        )}
      </div>
      {isAuthenticated ? (
        <NotificationDrawer
          open={drawerOpen}
          notifications={notifications}
          onOpenItem={(notificationId) => {
            void markAsRead(notificationId);
            setDrawerOpen(false);
          }}
          onMarkAllRead={() => void markAllAsRead()}
        />
      ) : null}
    </header>
  );
}
