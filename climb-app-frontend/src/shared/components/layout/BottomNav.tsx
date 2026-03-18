import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { mainNavigation } from '../../../app/config/navigation';

export default function BottomNav() {
  const { t } = useLanguage();

  return (
    <nav className="bottom-nav" aria-label={t('Primary navigation')}>
      {mainNavigation.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`.trim()}
        >
          {t(item.label)}
        </NavLink>
      ))}
    </nav>
  );
}
