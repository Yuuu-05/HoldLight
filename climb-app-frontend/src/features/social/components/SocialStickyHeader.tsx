import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';

export type SocialTabId = 'feed' | 'rooms' | 'volunteer';

interface SocialStickyHeaderProps {
  activeTab: SocialTabId;
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  showContextNote?: boolean;
}

const socialTabs: Array<{ id: SocialTabId; to: string; label: string }> = [
  { id: 'feed', to: routes.socialFeed, label: 'Community feed' },
  { id: 'rooms', to: routes.socialRooms, label: 'Rooms' },
  { id: 'volunteer', to: routes.volunteerBoard, label: 'Volunteer' },
];

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="social-search-icon" aria-hidden="true" fill="none">
      <circle cx="10.5" cy="10.5" r="4.75" stroke="currentColor" strokeWidth="1.9" />
      <path d="M14.2 14.2 18.2 18.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export default function SocialStickyHeader({
  activeTab,
  search,
  onSearchChange,
  placeholder,
  eyebrow,
  title,
  description,
  showContextNote = true,
}: SocialStickyHeaderProps) {
  const { t } = useLanguage();
  const socialContextCopy = {
    feed: t('Social keeps feed posts, climbing rooms, and volunteer support in one calm community layer.'),
    rooms: t('Rooms live inside the same social layer, so partners can plan sessions, gym meetups, and lightweight help requests together.'),
    volunteer: t('Volunteer support is now grouped under Social, so requests, contact intents, and community coordination stay in one place.'),
  }[activeTab];

  return (
    <div className="social-header-shell">
      <header className="social-sticky-header">
        {eyebrow || title || description ? (
          <div className="social-header-copy">
            {eyebrow ? <p className="social-eyebrow">{eyebrow}</p> : null}
            {title ? <h1 className="social-header-title">{title}</h1> : null}
            {description ? <p className="social-header-description">{description}</p> : null}
            {showContextNote ? <p className="social-header-note">{socialContextCopy}</p> : null}
          </div>
        ) : null}

        <label className="social-search-pill">
          <SearchGlyph />
          <input
            className="social-search-input"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder={placeholder ?? t('Search')}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label={placeholder ?? t('Search')}
          />
        </label>

        <nav className="social-tab-row" aria-label={t('Social')}>
          {socialTabs.map((tab) => (
            <Link
              key={tab.id}
              className={`social-tab-pill ${activeTab === tab.id ? 'is-active' : ''}`.trim()}
              to={tab.to}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {t(tab.label)}
            </Link>
          ))}
        </nav>
      </header>
    </div>
  );
}
