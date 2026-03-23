import { routes } from '../../shared/constants/routes';

export type MainNavigationItemId = 'dashboard' | 'tutorial' | 'assist' | 'social' | 'profile';

export type MainNavigationItem = {
  id: MainNavigationItemId;
  label: string;
  to: string;
  matchPrefixes: string[];
  isFab?: boolean;
};

export const mainNavigation: MainNavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: routes.dashboard,
    matchPrefixes: [routes.dashboard],
  },
  {
    id: 'tutorial',
    label: 'Tutorial',
    to: routes.tutorialHome,
    matchPrefixes: [routes.tutorialHome],
  },
  {
    id: 'assist',
    label: 'Assist',
    to: routes.scanWall,
    matchPrefixes: ['/climb'],
    isFab: true,
  },
  {
    id: 'social',
    label: 'Social',
    to: routes.socialFeed,
    matchPrefixes: [routes.socialFeed],
  },
  {
    id: 'profile',
    label: 'Profile',
    to: routes.profile,
    matchPrefixes: [routes.profile],
  },
];
