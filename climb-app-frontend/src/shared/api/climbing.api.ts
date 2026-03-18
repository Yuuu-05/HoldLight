import { apiClient } from './client';
import {
  appendStoredGuidanceLogs,
  getActiveStoredScan,
  getActiveStoredSession,
  getStoredGuidanceLogs,
  listStoredScans,
  listStoredSessions,
  upsertStoredScan,
  upsertStoredSession,
} from '../../features/climb-assist/store/climbAssist.store';
import { createLocalScanRecord } from '../../features/climb-assist/services/scan.service';
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

function canUseRemoteApi() {
  const token = readStorage<string | null>(storageKeys.token, null);
  return Boolean(token && !token.startsWith(DEV_TOKEN_PREFIX));
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveClimbScanApi(payload: CreateClimbScanPayload) {
  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.post<{ success: boolean; scan: ClimbScan }>('/climb-scans', payload);
      const normalizedScan: ClimbScan = {
        ...data.scan,
        id: data.scan.id || data.scan._id || makeId('scan'),
      };
      return upsertStoredScan(normalizedScan);
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  return upsertStoredScan(createLocalScanRecord(payload));
}

export async function getLatestClimbScanApi() {
  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.get<{ success: boolean; scan: ClimbScan | null }>('/climb-scans/latest/me');
      if (!data.scan) return null;
      const normalizedScan: ClimbScan = {
        ...data.scan,
        id: data.scan.id || data.scan._id || makeId('scan'),
      };
      return upsertStoredScan(normalizedScan);
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  return getActiveStoredScan();
}

export async function listClimbScansApi() {
  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.get<{ success: boolean; scans: ClimbScan[] }>('/climb-scans');
      return data.scans.map((scan) => upsertStoredScan({ ...scan, id: scan.id || scan._id || makeId('scan') }));
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  return listStoredScans();
}

export async function updateClimbScanApi(id: string, payload: UpdateClimbScanPayload) {
  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.patch<{ success: boolean; scan: ClimbScan }>(`/climb-scans/${id}`, payload);
      return upsertStoredScan({ ...data.scan, id: data.scan.id || data.scan._id || id });
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  const current = getActiveStoredScan();
  if (!current) {
    throw new Error('No active climb scan found.');
  }

  const nextScan: ClimbScan = {
    ...current,
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
    availableColors: payload.availableColors || payload.wallMap?.colors || current.availableColors,
    wallMap: payload.wallMap || current.wallMap,
  };

  return upsertStoredScan(nextScan);
}

export async function createClimbSessionApi(payload: CreateClimbSessionPayload) {
  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.post<{ success: boolean; session: ClimbSession }>('/climb-sessions', payload);
      return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || makeId('session') });
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  const localSession: ClimbSession = {
    id: makeId('session'),
    routeId: payload.routeId || '',
    currentTargetHoldId: payload.currentTargetHoldId || '',
    cueIndex: payload.cueIndex ?? 0,
    completed: payload.completed ?? false,
    status: payload.status ?? 'draft',
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return upsertStoredSession(localSession);
}

export async function updateClimbSessionApi(id: string, payload: UpdateClimbSessionPayload) {
  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.patch<{ success: boolean; session: ClimbSession }>(`/climb-sessions/${id}`, payload);
      return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || id });
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  const current = getActiveStoredSession();
  if (!current) {
    throw new Error('No active climb session found.');
  }

  const nextSession: ClimbSession = {
    ...current,
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
  };

  return upsertStoredSession(nextSession);
}

export async function getClimbSessionApi() {
  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.get<{ success: boolean; session: ClimbSession | null }>('/climb-sessions/active/me');
      if (!data.session) return null;
      return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || makeId('session') });
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  return getActiveStoredSession();
}

export async function listClimbSessionsHistoryApi() {
  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.get<{ success: boolean; sessions: ClimbSession[] }>('/climb-sessions/history/me');
      return data.sessions.map((session) => upsertStoredSession({ ...session, id: session.id || session._id || makeId('session') }));
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  return listStoredSessions();
}

export async function saveGuidanceLogsApi(logs: GuidanceLog[]) {
  if (logs.length === 0) return [];

  if (canUseRemoteApi()) {
    try {
      const { data } = await apiClient.post<{ success: boolean; logs: GuidanceLog[] }>('/guidance-logs/batch', { logs });
      return appendStoredGuidanceLogs(
        data.logs.map((log) => ({ ...log, id: log.id || log._id || makeId('log') })),
      );
    } catch {
      // Fall back to local prototype persistence.
    }
  }

  return appendStoredGuidanceLogs(logs.map((log) => ({ ...log, id: log.id || makeId('log') })));
}

export async function getGuidanceLogsApi(sessionId?: string) {
  return getStoredGuidanceLogs(sessionId);
}
