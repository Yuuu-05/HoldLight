import type { CSSProperties } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { profileBadgeCatalog } from '../constants/badges';

interface ProfileBadgeWallProps {
  ownedBadgeIds: string[];
  visibleBadgeIds: string[];
  onToggleVisibility: (badgeId: string) => void;
  isSaving: boolean;
}

export default function ProfileBadgeWall({
  ownedBadgeIds,
  visibleBadgeIds,
  onToggleVisibility,
  isSaving,
}: ProfileBadgeWallProps) {
  const { t } = useLanguage();

  return (
    <div className="profile-badge-wall">
      <div className="profile-badge-overview" aria-label={t('Badge wall overview')}>
        <div className="profile-badge-count">
          <span>{t('Earned')}</span>
          <strong>{ownedBadgeIds.length}</strong>
        </div>
        <div className="profile-badge-count">
          <span>{t('Displayed')}</span>
          <strong>{visibleBadgeIds.length}</strong>
        </div>
      </div>

      <div className="profile-badge-grid">
        {profileBadgeCatalog.map((badge) => {
          const owned = ownedBadgeIds.includes(badge.id);
          const visible = visibleBadgeIds.includes(badge.id);
          const style = { '--badge-accent': badge.accent } as CSSProperties;

          return (
            <button
              key={badge.id}
              type="button"
              className={`profile-badge-chip shape-${badge.shape} ${owned ? 'is-owned' : 'is-locked'} ${visible ? 'is-visible' : ''}`.trim()}
              style={style}
              onClick={() => owned && onToggleVisibility(badge.id)}
              disabled={!owned || isSaving}
              aria-pressed={owned ? visible : undefined}
            >
              <span className="profile-badge-glyph" aria-hidden="true" />

              <span className="profile-badge-copy">
                <strong>{t(badge.label)}</strong>
                <span>{owned ? t(badge.summary) : t(badge.unlockHint)}</span>
              </span>

              <span className="profile-badge-state">
                {owned ? (visible ? t('Visible on card') : t('Hidden from card')) : t('Locked')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
