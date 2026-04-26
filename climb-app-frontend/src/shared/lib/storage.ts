import { env } from '../../app/config/env';

export const storageKeys = {
  token: `${env.storagePrefix}:token`,
  user: `${env.storagePrefix}:user`,
  onboardingOverride: `${env.storagePrefix}:onboarding-override`,
  devAuthRole: `${env.storagePrefix}:dev-auth-role`,
  notificationReadIds: `${env.storagePrefix}:notification-read-ids`,
  accessibility: `${env.storagePrefix}:accessibility`,
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
