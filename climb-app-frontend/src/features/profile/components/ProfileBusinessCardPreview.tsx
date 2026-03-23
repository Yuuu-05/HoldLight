import type { CSSProperties } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Modal from '../../../shared/components/ui/Modal';
import type { User } from '../../../shared/types/user';
import { getRoleLabel } from '../../../shared/utils/getRoleLabel';
import type { ProfileBadgeDefinition } from '../constants/badges';
import { getUserInitials } from '../utils/profileDisplay';

interface ProfileBusinessCardPreviewProps {
  open: boolean;
  onClose: () => void;
  user: User;
  badges: ProfileBadgeDefinition[];
  lastUpdated: string;
}

export default function ProfileBusinessCardPreview({
  open,
  onClose,
  user,
  badges,
  lastUpdated,
}: ProfileBusinessCardPreviewProps) {
  const { t } = useLanguage();
  const roleLabel = t(getRoleLabel(user.role));
  const experience = user.profile?.climbingExperience || t('Not set yet');
  const accessibilityNote = user.profile?.accessibilityNeeds;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Profile card preview')}
      description={t('This preview shows the badge wall and identity details currently selected on your profile card.')}
      variant="sheet"
      panelClassName="profile-sheet profile-card-sheet"
    >
      <div className="profile-sheet-grabber" aria-hidden="true" />

      <div className="profile-card-preview-shell">
        <p className="profile-sheet-kicker">{t('Climber card')}</p>

        <article className="profile-card-preview">
          <span className="profile-card-preview-compass" aria-hidden="true" />
          <span className="profile-card-preview-ridge" aria-hidden="true" />

          <div className="profile-card-preview-header">
            <div className="profile-card-preview-avatar" aria-hidden="true">
              {getUserInitials(user.username)}
            </div>

            <div className="stack-sm profile-card-preview-copy">
              <p className="profile-card-preview-kicker">{t('Climber card')}</p>
              <h3>{user.username}</h3>
              <p className="profile-card-preview-role">{roleLabel}</p>
            </div>
          </div>

          <div className="profile-card-preview-ribbon">
            <span>{t('Experience')}</span>
            <strong>{experience}</strong>
          </div>

          <div className="profile-card-preview-meta">
            <div>
              <span>{t('Email')}</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>{t('Updated')}</span>
              <strong>{lastUpdated}</strong>
            </div>
            <div>
              <span>{t('Displayed badges')}</span>
              <strong>{badges.length}</strong>
            </div>
          </div>

          {accessibilityNote ? (
            <section className="profile-card-preview-note">
              <span>{t('Accessibility preferences')}</span>
              <strong>{accessibilityNote}</strong>
            </section>
          ) : null}

          <section className="profile-card-preview-wall">
            <header className="profile-card-preview-wall-header">
              <span>{t('Badge wall')}</span>
              <strong>{badges.length}</strong>
            </header>

            {badges.length ? (
              <div className="profile-card-preview-badges">
                {badges.map((badge) => {
                  const style = { '--badge-accent': badge.accent } as CSSProperties;

                  return (
                    <span key={badge.id} className={`profile-card-preview-badge shape-${badge.shape}`.trim()} style={style}>
                      <span className="profile-card-preview-badge-dot" aria-hidden="true" />
                      {t(badge.label)}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="profile-card-preview-empty">{t('No badges selected for display yet.')}</p>
            )}
          </section>
        </article>
      </div>
    </Modal>
  );
}
