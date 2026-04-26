import { readStorage, storageKeys, writeStorage } from '../../../shared/lib/storage';
import type { ClimbScan, ClimbSession, GuidanceLog } from '../../../shared/types/climb';

const MAX_STORED_SCANS = 4;
const MAX_STORED_COVER_IMAGE_LENGTH = 220_000;

function sanitizeScanForStorage(scan: ClimbScan): ClimbScan {
  if (!scan.coverImageUrl) {
    return scan;
  }

  const shouldDropCoverImage = scan.coverImageUrl.startsWith('data:image/')
    && scan.coverImageUrl.length > MAX_STORED_COVER_IMAGE_LENGTH;

  if (!shouldDropCoverImage) {
    return scan;
  }

  return {
    ...scan,
    coverImageUrl: '',
  };
}

export function listStoredScans() {
  return readStorage<ClimbScan[]>(storageKeys.climbScans, []);
}

export function upsertStoredScan(scan: ClimbScan) {
  const scans = listStoredScans();
  const normalizedScan = sanitizeScanForStorage(scan);
  const nextScans = [normalizedScan, ...scans.filter((item) => item.id !== normalizedScan.id)]
    .slice(0, MAX_STORED_SCANS)
    .map(sanitizeScanForStorage);
  writeStorage(storageKeys.climbScans, nextScans);
  writeStorage(storageKeys.activeClimbScanId, normalizedScan.id);
  return normalizedScan;
}

export function getActiveStoredScan() {
  const activeId = readStorage<string | null>(storageKeys.activeClimbScanId, null);
  return listStoredScans().find((scan) => scan.id === activeId) ?? listStoredScans()[0] ?? null;
}

export function listStoredSessions() {
  return readStorage<ClimbSession[]>(storageKeys.climbSessions, []);
}

export function upsertStoredSession(session: ClimbSession) {
  const sessions = listStoredSessions();
  const nextSessions = [session, ...sessions.filter((item) => item.id !== session.id)];
  writeStorage(storageKeys.climbSessions, nextSessions);
  writeStorage(storageKeys.activeClimbSessionId, session.id);
  writeStorage(storageKeys.climbSession, session);
  return session;
}

export function getActiveStoredSession() {
  const activeId = readStorage<string | null>(storageKeys.activeClimbSessionId, null);
  return listStoredSessions().find((session) => session.id === activeId) ?? readStorage<ClimbSession | null>(storageKeys.climbSession, null);
}

export function appendStoredGuidanceLogs(logs: GuidanceLog[]) {
  const existing = readStorage<GuidanceLog[]>(storageKeys.guidanceLogs, []);
  const nextLogs = [...existing, ...logs];
  writeStorage(storageKeys.guidanceLogs, nextLogs);
  return nextLogs;
}

export function getStoredGuidanceLogs(sessionId?: string) {
  const existing = readStorage<GuidanceLog[]>(storageKeys.guidanceLogs, []);
  return sessionId ? existing.filter((log) => log.sessionId === sessionId) : existing;
}
