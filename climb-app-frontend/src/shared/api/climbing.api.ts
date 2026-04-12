import { apiClient } from './client';
import {
  appendStoredGuidanceLogs,
  getStoredGuidanceLogs,
  upsertStoredScan,
  upsertStoredSession,
} from '../../features/climb-assist/store/climbAssist.store';
import { readStorage, storageKeys } from '../lib/storage';
import type {
  ClimbScan,
  ClimbSession,
  CreateClimbScanPayload,
  CreateClimbSessionPayload,
  GuidanceLog,
  UpdateClimbScanPayload,
  UpdateClimbSessionPayload,
} from '../types/climb';

const DEV_TOKEN_PREFIX = 'dev-auth-token:';

function requireBackendSession(label: string) {
  const token = readStorage<string | null>(storageKeys.token, null);
  if (!token || token.startsWith(DEV_TOKEN_PREFIX)) {
    throw new Error(`Sign in with a real backend account to use ${label}.`);
  }
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveClimbScanApi(payload: CreateClimbScanPayload) {
  requireBackendSession('wall scans');
  const { data } = await apiClient.post<{ success: boolean; scan: ClimbScan }>('/climb-scans', payload);
  const normalizedScan: ClimbScan = {
    ...data.scan,
    id: data.scan.id || data.scan._id || makeId('scan'),
  };
  return upsertStoredScan(normalizedScan);
}

export async function getLatestClimbScanApi() {
  requireBackendSession('climb scan retrieval');
  const { data } = await apiClient.get<{ success: boolean; scan: ClimbScan | null }>('/climb-scans/latest/me');
  if (!data.scan) return null;
  const normalizedScan: ClimbScan = {
    ...data.scan,
    id: data.scan.id || data.scan._id || makeId('scan'),
  };
  return upsertStoredScan(normalizedScan);
}

export async function listClimbScansApi() {
  requireBackendSession('climb scan history');
  const { data } = await apiClient.get<{ success: boolean; scans: ClimbScan[] }>('/climb-scans');
  return data.scans.map((scan) => upsertStoredScan({ ...scan, id: scan.id || scan._id || makeId('scan') }));
}

export async function updateClimbScanApi(id: string, payload: UpdateClimbScanPayload) {
  requireBackendSession('climb scan updates');
  const { data } = await apiClient.patch<{ success: boolean; scan: ClimbScan }>(`/climb-scans/${id}`, payload);
  return upsertStoredScan({ ...data.scan, id: data.scan.id || data.scan._id || id });
}

export async function createClimbSessionApi(payload: CreateClimbSessionPayload) {
  requireBackendSession('climb sessions');
  const { data } = await apiClient.post<{ success: boolean; session: ClimbSession }>('/climb-sessions', payload);
  return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || makeId('session') });
}

export async function updateClimbSessionApi(id: string, payload: UpdateClimbSessionPayload) {
  requireBackendSession('climb session updates');
  const { data } = await apiClient.patch<{ success: boolean; session: ClimbSession }>(`/climb-sessions/${id}`, payload);
  return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || id });
}

export async function getClimbSessionApi() {
  requireBackendSession('active climb session retrieval');
  const { data } = await apiClient.get<{ success: boolean; session: ClimbSession | null }>('/climb-sessions/active/me');
  if (!data.session) return null;
  return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || makeId('session') });
}

export async function listClimbSessionsHistoryApi() {
  requireBackendSession('climb session history');
  const { data } = await apiClient.get<{ success: boolean; sessions: ClimbSession[] }>('/climb-sessions/history/me');
  return data.sessions.map((session) => upsertStoredSession({ ...session, id: session.id || session._id || makeId('session') }));
}

export async function saveGuidanceLogsApi(logs: GuidanceLog[]) {
  if (logs.length === 0) return [];
  requireBackendSession('guidance logs');
  const { data } = await apiClient.post<{ success: boolean; logs: GuidanceLog[] }>('/guidance-logs/batch', { logs });
  return appendStoredGuidanceLogs(
    data.logs.map((log) => ({ ...log, id: log.id || log._id || makeId('log') })),
  );
}

export async function getGuidanceLogsApi(sessionId?: string) {
  return getStoredGuidanceLogs(sessionId);
}
