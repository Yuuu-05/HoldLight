import type { User } from '../../../shared/types/user';

export type BadgeShape = 'pebble' | 'hex' | 'crest' | 'ribbon' | 'slab' | 'orbit';

export interface ProfileBadgeDefinition {
  id: string;
  label: string;
  summary: string;
  unlockHint: string;
  accent: string;
  shape: BadgeShape;
}

export const profileBadgeCatalog: ProfileBadgeDefinition[] = [
  {
    id: 'first-grip',
    label: 'First Grip',
    summary: 'Your account is on the wall and ready to climb.',
    unlockHint: 'Unlock by joining the app.',
    accent: '#ef5b2a',
    shape: 'pebble',
  },
  {
    id: 'steady-core',
    label: 'Steady Core',
    summary: 'You completed the essential profile details.',
    unlockHint: 'Unlock by finishing the profile basics.',
    accent: '#d77c38',
    shape: 'slab',
  },
  {
    id: 'route-reader',
    label: 'Route Reader',
    summary: 'Your climbing experience is saved for route guidance.',
    unlockHint: 'Unlock by adding climbing experience.',
    accent: '#f0b54d',
    shape: 'hex',
  },
  {
    id: 'echo-line',
    label: 'Echo Line',
    summary: 'Accessibility preferences are part of your setup.',
    unlockHint: 'Unlock by adding accessibility support details.',
    accent: '#4b8f8c',
    shape: 'orbit',
  },
  {
    id: 'guide-knot',
    label: 'Guide Knot',
    summary: 'You carry a support-focused climbing role.',
    unlockHint: 'Unlock by taking a guide-oriented role.',
    accent: '#3d6aa2',
    shape: 'ribbon',
  },
  {
    id: 'summit-mark',
    label: 'Summit Mark',
    summary: 'Your role signals confident wall navigation.',
    unlockHint: 'Unlock by switching to an advanced role.',
    accent: '#6b5b95',
    shape: 'crest',
  },
];

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function getDerivedBadgeIds(user: User | null | undefined, isOnboarded: boolean) {
  if (!user) return [];

  const derived = ['first-grip'];
  const profile = user.profile ?? {};

  if (isOnboarded) {
    derived.push('steady-core');
  }

  if (profile.climbingExperience) {
    derived.push('route-reader');
  }

  if (profile.accessibilityNeeds) {
    derived.push('echo-line');
  }

  if (user.role === 'volunteer' || user.role === 'visually_impaired') {
    derived.push('guide-knot');
  }

  if (user.role === 'experienced' || user.role === 'visually_impaired') {
    derived.push('summit-mark');
  }

  return uniq(derived);
}

export function getOwnedBadgeIds(user: User | null | undefined, isOnboarded: boolean) {
  const saved = user?.profile?.badgeWall?.ownedBadgeIds ?? [];
  return uniq([...getDerivedBadgeIds(user, isOnboarded), ...saved]);
}

export function getVisibleBadgeIds(user: User | null | undefined, isOnboarded: boolean) {
  const owned = getOwnedBadgeIds(user, isOnboarded);
  const savedVisible = user?.profile?.badgeWall?.visibleBadgeIds;

  if (!savedVisible) {
    return owned;
  }

  return uniq(savedVisible).filter((badgeId) => owned.includes(badgeId));
}
