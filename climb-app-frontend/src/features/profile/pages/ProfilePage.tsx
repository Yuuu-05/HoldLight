import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import { formatDate } from '../../../shared/utils/formatDate';
import ProfileBadgeWall from '../components/ProfileBadgeWall';
import ProfileBusinessCardPreview from '../components/ProfileBusinessCardPreview';
import { getOwnedBadgeIds, getVisibleBadgeIds, profileBadgeCatalog } from '../constants/badges';
import { getUserInitials } from '../utils/profileDisplay';

const completionFieldTotal = 5;

type ProfileActionIconKind = 'edit' | 'role' | 'guide' | 'preview';

export default function ProfilePage() {
  const { user, isProfileComplete, isUsingDevAuth, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [badgeMessage, setBadgeMessage] = useState('');
  usePageTitle('Profile');

  if (!user) return null;

  const roleLabel = t(getRoleLabel(user.role));
  const experience = user.profile?.climbingExperience || t('Not set yet');
  const profileStatus = isProfileComplete ? t('Complete') : t('Needs more details');
  const birthday = user.profile?.birthday ? formatDate(user.profile.birthday) : t('Not set yet');
  const lastUpdated = user.updatedAt ? formatDate(user.updatedAt) : t('Not set yet');
  const replayGuideLabel = t('View guide again');
  const replayGuideHint = t('If you skipped the first guide or want to review the main entry points again, reopen it here.');
  const ownedBadgeIds = getOwnedBadgeIds(user, isProfileComplete);
  const visibleBadgeIds = getVisibleBadgeIds(user, isProfileComplete);
  const visibleBadges = profileBadgeCatalog.filter((badge) => visibleBadgeIds.includes(badge.id));
  const completionFieldCount = [
    user.profile?.gender,
    user.profile?.birthday,
    user.profile?.height,
    user.profile?.weight,
    user.profile?.climbingExperience,
  ].filter(Boolean).length;
  const completionPercent = Math.round((completionFieldCount / completionFieldTotal) * 100);
  const accessibilitySettings = user.preferences?.accessibility;
  const accessibilitySignals = [
    accessibilitySettings?.speechEnabled || accessibilitySettings?.voiceCommandsEnabled
      ? t('Voice guidance on')
      : '',
    accessibilitySettings?.highContrast ? t('High contrast mode') : '',
    accessibilitySettings?.largeText ? t('Large text') : '',
    accessibilitySettings?.simplifiedMode ? t('Simplified mode') : '',
    !accessibilitySettings?.speechEnabled &&
    !accessibilitySettings?.voiceCommandsEnabled &&
    !accessibilitySettings?.highContrast &&
    !accessibilitySettings?.largeText &&
    !accessibilitySettings?.simplifiedMode &&
    user.profile?.accessibilityNeeds
      ? t('Accessibility note saved')
      : '',
  ].filter(Boolean);
  const accessibilityHeadline = accessibilitySignals[0] || t('No accessibility note yet');
  const accessibilityDescription =
    user.profile?.accessibilityNeeds ||
    t('These preferences help shape read-aloud support, focus guidance, and volunteer matching.');
  const passportFacts = [
    { label: t('Birthday'), value: birthday },
    { label: t('Height (cm)'), value: user.profile?.height ? `${user.profile.height}` : t('Not set yet') },
    { label: t('Weight (kg)'), value: user.profile?.weight ? `${user.profile.weight}` : t('Not set yet') },
    { label: t('Last updated:'), value: lastUpdated },
  ];
  const actionBlocks = [
    {
      to: routes.profileEdit,
      label: t('Edit profile'),
      copy: t('Update personal details, climbing experience, and accessibility support needs.'),
      icon: 'edit' as const,
      toneClassName: 'profile-action-tone-sand',
    },
    {
      to: routes.roleSettings,
      label: t('Role settings'),
      copy: t('The interface adapts based on this role, including dashboard guidance, tutorial emphasis, volunteer flows, and accessibility shortcuts.'),
      icon: 'role' as const,
      toneClassName: 'profile-action-tone-sky',
    },
    {
      to: `${routes.onboarding}?mode=guide&returnTo=profile`,
      label: replayGuideLabel,
      copy: replayGuideHint,
      icon: 'guide' as const,
      toneClassName: 'profile-action-tone-lilac',
    },
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
    <div className="stack-lg profile-shell profile-passport-shell">
      <section className="page-card profile-passport-stage">
        <button
          type="button"
          className="profile-id-card"
          onClick={() => setPreviewOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={previewOpen}
          aria-label={`${user.username}. ${roleLabel}. ${experience}. ${t('Open profile card preview')}`}
        >
          <span className="profile-id-card-wash" aria-hidden="true" />
          <span className="profile-id-card-compass" aria-hidden="true" />
          <span className="profile-id-card-ridge" aria-hidden="true" />

          <span className="profile-id-avatar" aria-hidden="true">
            {getUserInitials(user.username)}
          </span>

          <span className="profile-id-copy">
            <span className="profile-id-kicker">{t('Climbing passport')}</span>
            <strong>{user.username}</strong>
            <span className="profile-id-role">{roleLabel}</span>

            <span className="profile-pill-row">
              <span className="profile-pill">
                {t('Experience')}: {experience}
              </span>
              <span className="profile-pill">{profileStatus}</span>
            </span>
          </span>

          <span className="profile-id-stamp">{t('Profile card preview')}</span>
        </button>

        <div className="profile-id-facts" aria-label={t('Account details')}>
          {passportFacts.map((fact) => (
            <div key={fact.label} className="profile-id-fact">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="profile-utility-grid">
        <section
          className="page-card profile-utility-card profile-completion-card"
          tabIndex={0}
          role="group"
          aria-labelledby="profile-completion-heading"
          aria-describedby="profile-completion-copy"
        >
          <span className="profile-card-doodle profile-card-doodle-warm" aria-hidden="true" />

          <div
            className="profile-completion-meter"
            style={{ '--completion-value': `${completionPercent}%` } as CSSProperties}
            aria-hidden="true"
          >
            <span>{completionPercent}%</span>
          </div>

          <div className="stack-sm profile-utility-copy">
            <p className="subtle-text">{t('Profile completion')}</p>
            <h2 id="profile-completion-heading">{t('Passport completion')}</h2>
            <p id="profile-completion-copy">
              {isProfileComplete
                ? t('Your passport is ready for role-based guidance.')
                : t('Add a few more basics to finish your climbing passport.')}
            </p>
          </div>

          <div className="profile-utility-footer">
            <span>{t('Fields ready')}</span>
            <strong>
              {completionFieldCount}/{completionFieldTotal}
            </strong>
          </div>
        </section>

        <section
          className="page-card profile-utility-card profile-a11y-card"
          tabIndex={0}
          role="group"
          aria-live="polite"
          aria-atomic="true"
          aria-labelledby="profile-a11y-heading"
          aria-describedby="profile-a11y-copy"
        >
          <span className="profile-card-doodle profile-card-doodle-cool" aria-hidden="true" />

          <div className="stack-sm profile-utility-copy">
            <p className="subtle-text">{t('Accessibility preferences')}</p>
            <h2 id="profile-a11y-heading">{accessibilityHeadline}</h2>
            <p id="profile-a11y-copy">{accessibilityDescription}</p>
          </div>

          <div className="profile-a11y-tags" role="list">
            {accessibilitySignals.length ? (
              accessibilitySignals.map((signal) => (
                <span key={signal} className="profile-a11y-tag" role="listitem">
                  {signal}
                </span>
              ))
            ) : (
              <span className="profile-a11y-tag is-muted">{t('No accessibility note yet')}</span>
            )}
          </div>
        </section>
      </div>

      {!isProfileComplete || isUsingDevAuth ? (
        <div className="profile-note-grid">
          {!isProfileComplete ? (
            <article className="page-card profile-note-card profile-note-card-warm">
              <p className="subtle-text">{t('Profile completion')}</p>
              <strong>{t('Your profile is still missing some basic information used for personalization.')}</strong>
            </article>
          ) : null}

          {isUsingDevAuth ? (
            <article className="page-card profile-note-card profile-note-card-cool">
              <p className="subtle-text">{t('Development account')}</p>
              <strong>{t('You are currently using the development auth shortcut. Role and profile changes are stored locally for preview purposes.')}</strong>
            </article>
          ) : null}
        </div>
      ) : null}

      <section className="page-card profile-badge-section" aria-labelledby="profile-badges-heading">
        <div className="profile-section-heading">
          <div className="stack-sm">
            <p className="subtle-text">
              {t('Collected route badges can be shown on your profile card. Tap an earned badge to show or hide it.')}
            </p>
            <h2 id="profile-badges-heading">{t('My climbing footprints')}</h2>
          </div>

          {badgeMessage ? (
            <p className="profile-inline-status" aria-live="polite">
              {badgeMessage}
            </p>
          ) : null}
        </div>

        <ProfileBadgeWall
          ownedBadgeIds={ownedBadgeIds}
          visibleBadgeIds={visibleBadgeIds}
          onToggleVisibility={handleToggleBadgeVisibility}
          isSaving={badgeSaving}
        />
      </section>

      <section className="page-card profile-actions-section" aria-labelledby="profile-actions-heading">
        <div className="profile-section-heading">
          <div className="stack-sm">
            <p className="subtle-text">{t('Passport tools')}</p>
            <h2 id="profile-actions-heading">{t('Quick actions')}</h2>
          </div>
        </div>

        <div className="profile-action-grid">
          {actionBlocks.map((action) => (
            <Link
              key={action.label}
              className={`profile-action-block ${action.toneClassName}`.trim()}
              to={action.to}
              aria-label={`${action.label}. ${action.copy}`}
            >
              <span className="profile-action-icon" aria-hidden="true">
                <ProfileActionIcon kind={action.icon} />
              </span>
              <span className="profile-action-copy">
                <strong>{action.label}</strong>
                <span>{action.copy}</span>
              </span>
            </Link>
          ))}

          <button
            type="button"
            className="profile-action-block profile-action-tone-orange"
            onClick={() => setPreviewOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={previewOpen}
            aria-label={`${t('Open profile card preview')}. ${t('This preview shows the badge wall and identity details currently selected on your profile card.')}`}
          >
            <span className="profile-action-icon" aria-hidden="true">
              <ProfileActionIcon kind="preview" />
            </span>
            <span className="profile-action-copy">
              <strong>{t('Profile card preview')}</strong>
              <span>{t('This preview shows the badge wall and identity details currently selected on your profile card.')}</span>
            </span>
          </button>
        </div>
      </section>

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

function ProfileActionIcon({ kind }: { kind: ProfileActionIconKind }) {
  switch (kind) {
    case 'edit':
      return (
        <svg viewBox="0 0 24 24" className="profile-action-icon-svg" aria-hidden="true" fill="none">
          <path
            d="M5.5 18.5h4.8l8.2-8.2a1.8 1.8 0 0 0 0-2.5l-1.1-1.1a1.8 1.8 0 0 0-2.5 0l-8.2 8.2z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
          />
          <path
            d="M13.7 7.1 16.9 10.3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
          />
        </svg>
      );

    case 'role':
      return (
        <svg viewBox="0 0 24 24" className="profile-action-icon-svg" aria-hidden="true" fill="none">
          <circle cx="12" cy="12" r="7.1" stroke="currentColor" strokeWidth="1.9" />
          <path
            d="M12 6.8 14.7 12 12 17.2 9.3 12z"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
          <path d="M12 4.4v2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M19.6 12h-2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M12 19.6v-2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M4.4 12h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );

    case 'guide':
      return (
        <svg viewBox="0 0 24 24" className="profile-action-icon-svg" aria-hidden="true" fill="none">
          <path
            d="M6.2 6.9c0-1 .8-1.8 1.8-1.8h4.2c1 0 2 .4 2.7 1.1l.4.4.4-.4c.7-.7 1.7-1.1 2.7-1.1h.4c1 0 1.8.8 1.8 1.8v10.2c0 .7-.6 1.3-1.3 1.3h-2.3c-1.3 0-2.6.5-3.5 1.4l-.2.2-.2-.2c-1-.9-2.2-1.4-3.5-1.4H7.5c-.7 0-1.3-.6-1.3-1.3z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path d="M12 6.1v11.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );

    case 'preview':
      return (
        <svg viewBox="0 0 24 24" className="profile-action-icon-svg" aria-hidden="true" fill="none">
          <rect
            x="5.2"
            y="6.1"
            width="13.6"
            height="11.8"
            rx="3.2"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path d="M8 10h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M8 13h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path
            d="M17.4 7.7l.4 1 .9.4-.9.4-.4 1-.4-1-.9-.4.9-.4z"
            fill="currentColor"
          />
        </svg>
      );

    default:
      return null;
  }
}
