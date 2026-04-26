import { Link, useNavigate } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../constants/routes';
import AppBrand from '../brand/AppBrand';
import Button from '../ui/Button';
import LanguageSwitcher from './LanguageSwitcher';
import { ArrowLeftIcon, SettingsIcon } from '../icons/AppIcons';

interface HeaderProps {
  variant?: 'default' | 'assist';
  onBack?: () => void;
}

export default function Header({ variant = 'default', onBack }: HeaderProps) {
  const { alwaysShowTextLabels, simplifiedMode } = useAccessibility();
  const { user, isAuthenticated, logout } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const isZh = language === 'zh';
  const isAssistHeader = variant === 'assist';
  const showBackLabel = alwaysShowTextLabels || simplifiedMode;

  const handleLogout = async () => {
    await logout();
    navigate(routes.home);
  };

  return (
    <header className={`site-header ${isAssistHeader ? 'site-header--assist' : ''}`.trim()}>
      <div className="header-brand-group">
        {onBack ? (
          <button
            type="button"
            className={`header-back-button ${showBackLabel ? 'has-label' : ''}`.trim()}
            onClick={onBack}
            aria-label={isZh ? '返回上一页' : 'Go back'}
          >
            <ArrowLeftIcon />
            {showBackLabel ? <span className="header-back-label">{t('Back')}</span> : null}
          </button>
        ) : null}
        <AppBrand to={isAuthenticated ? routes.dashboard : routes.home} size="sm" label={t('HoldLight')} />
      </div>
      <div className="header-actions">
        {isAuthenticated ? (
          <>
            <Link className="header-system-link" to={routes.profileSettings} aria-label={isZh ? '打开设置' : 'Open settings'}>
              <SettingsIcon />
              <span>{t('Settings')}</span>
            </Link>
            <LanguageSwitcher />
            {isAssistHeader ? null : (
              <>
                <span className="header-user">{t('Hi')}, {user?.username}</span>
                <Button variant="ghost" className="header-auth-button" onClick={handleLogout}>{t('Logout')}</Button>
              </>
            )}
          </>
        ) : (
          <>
            <LanguageSwitcher />
            <Link className="header-auth-link" to={routes.login}>{t('Login')}</Link>
          </>
        )}
      </div>
    </header>
  );
}
