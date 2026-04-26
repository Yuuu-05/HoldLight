import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { SettingsIcon } from '../../../shared/components/icons/AppIcons';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { getUserInitials } from '../utils/profileDisplay';
import '../profile.css';

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  usePageTitle('Profile');

  if (!user) return null;

  return (
    <div className="profile-shell profile-passport-shell">
      <section className="profile-passport-stage" aria-labelledby="profile-hero-heading">
        <article className="profile-id-card">
          <span className="profile-id-card-wash" aria-hidden="true" />
          <span className="profile-id-card-compass" aria-hidden="true" />
          <span className="profile-id-card-ridge" aria-hidden="true" />

          <div className="profile-id-avatar" aria-hidden="true">
            {getUserInitials(user.username)}
          </div>

          <div className="profile-id-copy">
            <span className="profile-id-kicker">{t('Profile')}</span>
            <h1 id="profile-hero-heading">{user.username}</h1>
          </div>
        </article>
      </section>

      <section className="profile-entry-section" aria-label={t('Settings')}>
        <Link className="profile-entry-row" to={routes.profileSettings}>
          <span className="profile-entry-icon" aria-hidden="true">
            <SettingsIcon />
          </span>
          <span className="profile-entry-copy">
            <strong>{t('Settings')}</strong>
            <span>{t('Username')}</span>
          </span>
        </Link>
      </section>
    </div>
  );
}
