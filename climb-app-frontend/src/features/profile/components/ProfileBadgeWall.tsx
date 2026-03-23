import { useState, type CSSProperties } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { triggerHaptic } from '../../../shared/lib/haptics';
import Button from '../../../shared/components/ui/Button';
import Modal from '../../../shared/components/ui/Modal';
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
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);

  const activeBadge = profileBadgeCatalog.find((badge) => badge.id === activeBadgeId) ?? null;
  const activeBadgeOwned = activeBadge ? ownedBadgeIds.includes(activeBadge.id) : false;
  const activeBadgeVisible = activeBadge ? visibleBadgeIds.includes(activeBadge.id) : false;

  return (
    <>
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
            const stateLabel = owned
              ? visible
                ? t('Visible on card')
                : t('Hidden from card')
              : t('Locked');

            return (
              <button
                key={badge.id}
                type="button"
                className={`profile-badge-chip shape-${badge.shape} ${owned ? 'is-owned' : 'is-locked'} ${visible ? 'is-visible' : ''}`.trim()}
                style={style}
                onClick={() => {
                  setActiveBadgeId(badge.id);
                  triggerHaptic(12);
                }}
                aria-haspopup="dialog"
                aria-pressed={owned ? visible : undefined}
                aria-label={`${stateLabel}. ${t(badge.label)}. ${owned ? t(badge.summary) : t(badge.unlockHint)}`}
              >
                <span className="profile-badge-glyph" aria-hidden="true" />
                <span className="profile-badge-pin" aria-hidden="true">
                  {"\u{1F4CC}"}
                </span>

                <span className="profile-badge-copy">
                  <strong>{t(badge.label)}</strong>
                  <span>{owned ? t(badge.summary) : t(badge.unlockHint)}</span>
                </span>

                <span className="profile-badge-state">{stateLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeBadge ? (
        <Modal
          open
          onClose={() => setActiveBadgeId(null)}
          title={t(activeBadge.label)}
          description={t(activeBadge.unlockHint)}
          variant="sheet"
          panelClassName="profile-sheet profile-badge-sheet"
        >
          <div className="profile-sheet-grabber" aria-hidden="true" />

          <article className="profile-badge-detail">
            <div className="profile-badge-detail-head">
              <span
                className={`profile-badge-detail-token shape-${activeBadge.shape}`.trim()}
                style={{ '--badge-accent': activeBadge.accent } as CSSProperties}
                aria-hidden="true"
              >
                <span className="profile-badge-detail-dot" />
              </span>

              <div className="stack-sm profile-badge-detail-copy">
                <p className="profile-badge-detail-kicker">
                  {activeBadgeOwned ? t('Collected badge') : t('Locked badge')}
                </p>
                <h3>{t(activeBadge.label)}</h3>
                <p>{activeBadgeOwned ? t(activeBadge.summary) : t(activeBadge.unlockHint)}</p>
              </div>
            </div>

            <div className="profile-badge-detail-grid">
              <div>
                <span>{t('Status')}</span>
                <strong>{activeBadgeOwned ? t('Earned') : t('Locked')}</strong>
              </div>
              <div>
                <span>{t('Display')}</span>
                <strong>
                  {activeBadgeOwned
                    ? activeBadgeVisible
                      ? t('Visible on card')
                      : t('Hidden from card')
                    : t('Unlock first')}
                </strong>
              </div>
            </div>

            <p className="subtle-text">
              {activeBadgeOwned
                ? activeBadgeVisible
                  ? t('This badge is pinned to your public climber card.')
                  : t('This badge is saved but hidden from your public climber card.')
                : t(activeBadge.unlockHint)}
            </p>

            {activeBadgeOwned ? (
              <div className="inline-actions wrap profile-badge-detail-actions">
                <Button
                  disabled={isSaving}
                  onClick={() => {
                    onToggleVisibility(activeBadge.id);
                    triggerHaptic([10, 32, 10]);
                  }}
                >
                  {activeBadgeVisible ? t('Hide from card') : t('Show on card')}
                </Button>
              </div>
            ) : null}
          </article>
        </Modal>
      ) : null}
    </>
  );
}
