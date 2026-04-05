import { routes } from '../../shared/constants/routes';

export type MainNavigationItemId = 'dashboard' | 'assist' | 'profile';

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
    id: 'assist',
    label: 'Assist',
    to: routes.scanWall,
    matchPrefixes: ['/climb'],
    isFab: true,
  },
  {
    id: 'profile',
    label: 'Profile',
    to: routes.profile,
    matchPrefixes: [routes.profile],
  },
];
