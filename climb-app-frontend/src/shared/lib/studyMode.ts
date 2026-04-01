import { env } from '../../app/config/env';
import { readStorage, storageKeys, writeStorage } from './storage';

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off']);
const QUERY_KEYS = ['studyMode', 'researchMode'];

function parseFlag(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (TRUTHY_VALUES.has(normalized)) return true;
  if (FALSY_VALUES.has(normalized)) return false;
  return null;
}

function readStudyModeOverrideFromLocation() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);

  for (const key of QUERY_KEYS) {
    const parsed = parseFlag(params.get(key));
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function syncStudyModeOverride() {
  const override = readStudyModeOverrideFromLocation();
  if (override === null || typeof window === 'undefined') {
    return null;
  }

  const current = readStorage<boolean>(storageKeys.studyMode, env.studyModeEnabledByDefault);
  if (current !== override) {
    writeStorage(storageKeys.studyMode, override);
  }

  return override;
}

export function isStudyModeEnabled() {
  const override = syncStudyModeOverride();
  if (override !== null) {
    return override;
  }

  return readStorage<boolean>(storageKeys.studyMode, env.studyModeEnabledByDefault);
}

export function getStudyModeRequirementMessage(targetLabel: string) {
  return `Study mode is enabled, so ${targetLabel} must use the backend only. Sign in with a real backend account and make sure the API server is reachable.`;
}
