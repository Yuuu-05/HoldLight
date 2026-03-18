import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import { formatDate } from '../../../shared/utils/formatDate';
import AccessibilityBadge from '../components/AccessibilityBadge';
import ProfileBadgeWall from '../components/ProfileBadgeWall';
import ProfileBusinessCardPreview from '../components/ProfileBusinessCardPreview';
import { getOwnedBadgeIds, getVisibleBadgeIds, profileBadgeCatalog } from '../constants/badges';
import { getUserInitials } from '../utils/profileDisplay';

export default function ProfilePage() {
  const { user, isOnboarded, isUsingDevAuth, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [badgeMessage, setBadgeMessage] = useState('');
  usePageTitle('Profile');

  if (!user) return null;

  const roleLabel = t(getRoleLabel(user.role));
  const profileStatus = isOnboarded ? t('Complete') : t('Needs more details');
  const birthday = user.profile?.birthday ? formatDate(user.profile.birthday) : t('Not set yet');
  const lastUpdated = user.updatedAt ? formatDate(user.updatedAt) : t('Not set yet');
  const ownedBadgeIds = getOwnedBadgeIds(user, isOnboarded);
  const visibleBadgeIds = getVisibleBadgeIds(user, isOnboarded);
  const visibleBadges = profileBadgeCatalog.filter((badge) => visibleBadgeIds.includes(badge.id));
  const profileItems = [
    { label: t('Experience'), value: user.profile?.climbingExperience || t('Not set yet') },
    { label: t('Gender'), value: user.profile?.gender || t('Not set yet') },
    { label: t('Birthday'), value: birthday },
    { label: t('Height (cm)'), value: user.profile?.height ? `${user.profile.height}` : t('Not set yet') },
    { label: t('Weight (kg)'), value: user.profile?.weight ? `${user.profile.weight}` : t('Not set yet') },
    { label: t('Displayed badges'), value: `${visibleBadgeIds.length}/${ownedBadgeIds.length}` },
  ];

  async function handleToggleBadgeVisibility(badgeId: string) {
    const nextVisibleBadgeIds = visibleBadgeIds.includes(badgeId)
      ? visibleBadgeIds.filter((currentId) => currentId !== badgeId)
      : [...visibleBadgeIds, badgeId];

    setBadgeSaving(true);
    setBadgeMessage('');

    try {
      await updateProfile({
        profile: {
          badgeWall: {
            ownedBadgeIds,
            visibleBadgeIds: nextVisibleBadgeIds,
          },
        },
      });

      setBadgeMessage(
        nextVisibleBadgeIds.includes(badgeId)
          ? t('Badge added to your card.')
          : t('Badge hidden from your card.'),
      );
    } catch (_error) {
      setBadgeMessage(t('Unable to update badge visibility right now.'));
    } finally {
      setBadgeSaving(false);
    }
  }

  return (
    <div className="stack-lg profile-shell">
      <section className="page-card profile-hero-card poster-primary-card">
        <div className="profile-hero-grid">
          <div className="profile-identity">
            <div className="profile-avatar" aria-hidden="true">
              {getUserInitials(user.username)}
            </div>

            <div className="stack-sm">
              <p className="subtle-text">{t('Personal profile')}</p>
              <h1>{user.username}</h1>
              <p>{t('Review your saved identity, role, and accessibility settings from one place.')}</p>

              <div className="profile-pill-row">
                <span className="profile-pill">{roleLabel}</span>
                <span className="profile-pill">{t('Experience')}: {user.profile?.climbingExperience || t('Not set yet')}</span>
                <span className="profile-pill">{profileStatus}</span>
              </div>
            </div>
          </div>

          <div className="profile-business-card">
            <div className="profile-business-head">
              <div className="stack-sm">
                <p className="subtle-text">{t('Account details')}</p>
                <strong>{user.email}</strong>
              </div>
              <AccessibilityBadge text={user.profile?.accessibilityNeeds} />
            </div>

            <div className="profile-business-grid">
              <div>
                <span>{t('Role')}</span>
                <strong>{roleLabel}</strong>
              </div>
              <div>
                <span>{t('Profile status:')}</span>
                <strong>{profileStatus}</strong>
              </div>
              <div>
                <span>{t('Last updated:')}</span>
                <strong>{lastUpdated}</strong>
              </div>
              <div>
                <span>{t('Email')}</span>
                <strong>{user.email}</strong>
              </div>
              <div>
                <span>{t('Displayed badges')}</span>
                <strong>{visibleBadgeIds.length}</strong>
              </div>
            </div>

            <div className="profile-business-badges">
              {visibleBadges.length ? (
                visibleBadges.slice(0, 4).map((badge) => (
                  <span key={badge.id} className="profile-business-badge">
                    {t(badge.label)}
                  </span>
                ))
              ) : (
                <span className="subtle-text">{t('No badges selected for display yet.')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="inline-actions wrap">
          <Link to={routes.profileEdit}>
            <Button>{t('Edit profile')}</Button>
          </Link>
          <Link to={routes.roleSettings}>
            <Button variant="secondary">{t('Role settings')}</Button>
          </Link>
          <Button variant="ghost" onClick={() => setPreviewOpen(true)}>
            {t('Preview card')}
          </Button>
        </div>
      </section>

      {!isOnboarded ? (
        <Card
          title={t('Profile completion')}
          className="profile-notice-card"
          actions={<Link className="text-link" to={routes.onboarding}>{t('Complete now')}</Link>}
        >
          <p>{t('Your profile is still missing some basic information used for personalization.')}</p>
        </Card>
      ) : null}

      {isUsingDevAuth ? (
        <Card title={t('Development account')} className="profile-notice-card profile-dev-card">
          <p>{t('You are currently using the development auth shortcut. Role and profile changes are stored locally for preview purposes.')}</p>
        </Card>
      ) : null}

      <div className="grid-2">
        <Card title={t('Profile summary')} className="profile-summary-card">
          <div className="profile-detail-grid">
            {profileItems.map((item) => (
              <div key={item.label} className="profile-detail-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('Accessibility preferences')} className="profile-access-card">
          <AccessibilityBadge text={user.profile?.accessibilityNeeds} />
          <p className="subtle-text">{t('These preferences help shape read-aloud support, focus guidance, and volunteer matching.')}</p>
        </Card>
      </div>

      <Card title={t('Badge wall')} className="profile-badge-card">
        <p className="subtle-text">
          {t('Collected route badges can be shown on your profile card. Tap an earned badge to show or hide it.')}
        </p>
        {badgeMessage ? <p className="subtle-text">{badgeMessage}</p> : null}
        <ProfileBadgeWall
          ownedBadgeIds={ownedBadgeIds}
          visibleBadgeIds={visibleBadgeIds}
          onToggleVisibility={handleToggleBadgeVisibility}
          isSaving={badgeSaving}
        />
      </Card>

      <ProfileBusinessCardPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        user={user}
        badges={visibleBadges}
        lastUpdated={lastUpdated}
      />
    </div>
  );
}
