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

  return (
    <Modal open={open} onClose={onClose} title={t('Profile card preview')}>
      <div className="profile-card-preview-shell">
        <article className="profile-card-preview">
          <div className="profile-card-preview-header">
            <div className="profile-card-preview-avatar" aria-hidden="true">
              {getUserInitials(user.username)}
            </div>

            <div className="stack-sm">
              <p className="profile-card-preview-kicker">{t('Climber card')}</p>
              <h3>{user.username}</h3>
              <p>{roleLabel}</p>
            </div>
          </div>

          <div className="profile-card-preview-meta">
            <div>
              <span>{t('Experience')}</span>
              <strong>{experience}</strong>
            </div>
            <div>
              <span>{t('Email')}</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>{t('Updated')}</span>
              <strong>{lastUpdated}</strong>
            </div>
          </div>

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

        <p className="subtle-text">
          {t('This preview shows the badge wall and identity details currently selected on your profile card.')}
        </p>
      </div>
    </Modal>
  );
}
