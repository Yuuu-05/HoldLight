import { env } from '../../app/config/env';

export const storageKeys = {
  token: `${env.storagePrefix}:token`,
  user: `${env.storagePrefix}:user`,
  devAuthRole: `${env.storagePrefix}:dev-auth-role`,
  socialUsers: `${env.storagePrefix}:social-users`,
  friendRequests: `${env.storagePrefix}:friend-requests`,
  climbingRooms: `${env.storagePrefix}:climbing-rooms`,
  notificationReadIds: `${env.storagePrefix}:notification-read-ids`,
  tutorialProgress: `${env.storagePrefix}:tutorial-progress`,
  accessibility: `${env.storagePrefix}:accessibility`,
  posts: `${env.storagePrefix}:posts`,
  volunteerPosts: `${env.storagePrefix}:volunteer-posts`,
  climbScans: `${env.storagePrefix}:climb-scans`,
  activeClimbScanId: `${env.storagePrefix}:active-climb-scan-id`,
  climbSessions: `${env.storagePrefix}:climb-sessions`,
  activeClimbSessionId: `${env.storagePrefix}:active-climb-session-id`,
  guidanceLogs: `${env.storagePrefix}:guidance-logs`,
  climbSession: `${env.storagePrefix}:climb-session`,
  lastRoute: `${env.storagePrefix}:last-route`,
};

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorage(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}
