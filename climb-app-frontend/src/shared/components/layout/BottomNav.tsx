import type { SVGProps } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { type MainNavigationItemId, mainNavigation } from '../../../app/config/navigation';
import { triggerHaptic } from '../../lib/haptics';

const navAriaLabels: Record<MainNavigationItemId, string> = {
  dashboard: 'Open dashboard',
  assist: 'Open assist',
  profile: 'Open profile center',
};

export default function BottomNav() {
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <nav
      className="bottom-nav"
      aria-label={t('Primary navigation')}
      style={{ gridTemplateColumns: `repeat(${mainNavigation.length}, minmax(0, 1fr))` }}
    >
      {mainNavigation.map((item) => {
        const isActive = item.matchPrefixes.some((prefix) => {
          if (location.pathname === prefix) {
            return true;
          }

          return location.pathname.startsWith(`${prefix}/`);
        });

        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={t(navAriaLabels[item.id])}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => triggerHaptic(10)}
            className={`bottom-nav-link ${item.isFab ? 'bottom-nav-link-fab' : ''} ${isActive ? 'active' : ''}`.trim()}
            data-nav-id={item.id}
          >
            <span className="bottom-nav-link-shell">
              <span className={`bottom-nav-link-badge ${item.isFab ? 'bottom-nav-link-badge-fab' : ''}`}>
                <BottomNavIcon itemId={item.id} active={item.isFab || isActive} />
              </span>
              <span className="bottom-nav-link-label">{t(item.label)}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

type BottomNavIconProps = {
  itemId: MainNavigationItemId;
  active: boolean;
};

function BottomNavIcon({ itemId, active }: BottomNavIconProps) {
  switch (itemId) {
    case 'dashboard':
      return <HomeIcon active={active} />;
    case 'assist':
      return <AssistIcon />;
    case 'profile':
      return <ProfileIcon active={active} />;
    default:
      return null;
  }
}

type IconProps = SVGProps<SVGSVGElement> & {
  active?: boolean;
};

function IconFrame({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className="bottom-nav-link-icon" aria-hidden="true" fill="none" {...props}>
      {children}
    </svg>
  );
}

function HomeIcon({ active }: IconProps) {
  const strokeWidth = active ? 2.1 : 1.9;

  if (active) {
    return (
      <IconFrame>
        <path
          d="M4.75 10.42 11.27 5a1 1 0 0 1 1.46 0l6.52 5.42"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <path
          d="M6.35 9.82v7.12a1.8 1.8 0 0 0 1.8 1.8h7.7a1.8 1.8 0 0 0 1.8-1.8V9.82"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <path
          d="M10.15 18.74v-4.07c0-.61.49-1.1 1.1-1.1h1.5c.61 0 1.1.49 1.1 1.1v4.07"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </IconFrame>
    );
  }

  return (
    <IconFrame>
      <path
        d="M4.75 10.42 11.27 5a1 1 0 0 1 1.46 0l6.52 5.42"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <path
        d="M6.35 9.82v7.12a1.8 1.8 0 0 0 1.8 1.8h7.7a1.8 1.8 0 0 0 1.8-1.8V9.82"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <path
        d="M10.15 18.74v-4.07c0-.61.49-1.1 1.1-1.1h1.5c.61 0 1.1.49 1.1 1.1v4.07"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconFrame>
  );
}

function AssistIcon() {
  return (
    <IconFrame>
      <path
        d="M8 5.6H7a2.4 2.4 0 0 0-2.4 2.4V9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.1"
      />
      <path
        d="M16 5.6h1a2.4 2.4 0 0 1 2.4 2.4V9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.1"
      />
      <path
        d="M8 18.4H7a2.4 2.4 0 0 1-2.4-2.4v-1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.1"
      />
      <path
        d="M16 18.4h1a2.4 2.4 0 0 0 2.4-2.4v-1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.1"
      />
      <path
        d="M12 9.3v5.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.1"
      />
      <path
        d="M9.3 12h5.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.1"
      />
    </IconFrame>
  );
}

function ProfileIcon({ active }: IconProps) {
  const strokeWidth = active ? 2.1 : 1.9;

  if (active) {
    return (
      <IconFrame>
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="4.25"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <circle cx="12" cy="10.05" r="2.25" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
        <path
          d="M8.05 16.25c.6-1.73 2.21-2.98 3.95-2.98s3.35 1.25 3.95 2.98"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </IconFrame>
    );
  }

  return (
    <IconFrame>
      <rect
        x="4.75"
        y="4.75"
        width="14.5"
        height="14.5"
        rx="4.25"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <circle cx="12" cy="10.05" r="2.25" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
      <path
        d="M8.05 16.25c.6-1.73 2.21-2.98 3.95-2.98s3.35 1.25 3.95 2.98"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconFrame>
  );
}
