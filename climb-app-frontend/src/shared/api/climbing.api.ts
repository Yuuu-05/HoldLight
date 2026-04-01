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
import { getStudyModeRequirementMessage, isStudyModeEnabled } from '../lib/studyMode';
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

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function resolveClimbApiCall<T>({
  label,
  remoteCall,
  fallbackCall,
}: {
  label: string;
  remoteCall: () => Promise<T>;
  fallbackCall: () => T | Promise<T>;
}) {
  const studyMode = isStudyModeEnabled();
  const remoteAvailable = canUseRemoteApi();

  if (studyMode && !remoteAvailable) {
    throw new Error(getStudyModeRequirementMessage(label));
  }

  if (remoteAvailable) {
    try {
      return await remoteCall();
    } catch (error) {
      if (studyMode) {
        throw new Error(
          `${getStudyModeRequirementMessage(label)} ${toErrorMessage(error, `The backend request for ${label} failed.`)}`,
        );
      }
    }
  }

  return fallbackCall();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveClimbScanApi(payload: CreateClimbScanPayload) {
  return resolveClimbApiCall({
    label: 'wall scans',
    remoteCall: async () => {
      const { data } = await apiClient.post<{ success: boolean; scan: ClimbScan }>('/climb-scans', payload);
      const normalizedScan: ClimbScan = {
        ...data.scan,
        id: data.scan.id || data.scan._id || makeId('scan'),
      };
      return upsertStoredScan(normalizedScan);
    },
    fallbackCall: () => upsertStoredScan(createLocalScanRecord(payload)),
  });
}

export async function getLatestClimbScanApi() {
  return resolveClimbApiCall({
    label: 'climb scan retrieval',
    remoteCall: async () => {
      const { data } = await apiClient.get<{ success: boolean; scan: ClimbScan | null }>('/climb-scans/latest/me');
      if (!data.scan) return null;
      const normalizedScan: ClimbScan = {
        ...data.scan,
        id: data.scan.id || data.scan._id || makeId('scan'),
      };
      return upsertStoredScan(normalizedScan);
    },
    fallbackCall: () => getActiveStoredScan(),
  });
}

export async function listClimbScansApi() {
  return resolveClimbApiCall({
    label: 'climb scan history',
    remoteCall: async () => {
      const { data } = await apiClient.get<{ success: boolean; scans: ClimbScan[] }>('/climb-scans');
      return data.scans.map((scan) => upsertStoredScan({ ...scan, id: scan.id || scan._id || makeId('scan') }));
    },
    fallbackCall: () => listStoredScans(),
  });
}

export async function updateClimbScanApi(id: string, payload: UpdateClimbScanPayload) {
  return resolveClimbApiCall({
    label: 'climb scan updates',
    remoteCall: async () => {
      const { data } = await apiClient.patch<{ success: boolean; scan: ClimbScan }>(`/climb-scans/${id}`, payload);
      return upsertStoredScan({ ...data.scan, id: data.scan.id || data.scan._id || id });
    },
    fallbackCall: () => {
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
    },
  });
}

export async function createClimbSessionApi(payload: CreateClimbSessionPayload) {
  return resolveClimbApiCall({
    label: 'climb sessions',
    remoteCall: async () => {
      const { data } = await apiClient.post<{ success: boolean; session: ClimbSession }>('/climb-sessions', payload);
      return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || makeId('session') });
    },
    fallbackCall: () => {
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
    },
  });
}

export async function updateClimbSessionApi(id: string, payload: UpdateClimbSessionPayload) {
  return resolveClimbApiCall({
    label: 'climb session updates',
    remoteCall: async () => {
      const { data } = await apiClient.patch<{ success: boolean; session: ClimbSession }>(`/climb-sessions/${id}`, payload);
      return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || id });
    },
    fallbackCall: () => {
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
    },
  });
}

export async function getClimbSessionApi() {
  return resolveClimbApiCall({
    label: 'active climb session retrieval',
    remoteCall: async () => {
      const { data } = await apiClient.get<{ success: boolean; session: ClimbSession | null }>('/climb-sessions/active/me');
      if (!data.session) return null;
      return upsertStoredSession({ ...data.session, id: data.session.id || data.session._id || makeId('session') });
    },
    fallbackCall: () => getActiveStoredSession(),
  });
}

export async function listClimbSessionsHistoryApi() {
  return resolveClimbApiCall({
    label: 'climb session history',
    remoteCall: async () => {
      const { data } = await apiClient.get<{ success: boolean; sessions: ClimbSession[] }>('/climb-sessions/history/me');
      return data.sessions.map((session) => upsertStoredSession({ ...session, id: session.id || session._id || makeId('session') }));
    },
    fallbackCall: () => listStoredSessions(),
  });
}

export async function saveGuidanceLogsApi(logs: GuidanceLog[]) {
  if (logs.length === 0) return [];

  return resolveClimbApiCall({
    label: 'guidance logs',
    remoteCall: async () => {
      const { data } = await apiClient.post<{ success: boolean; logs: GuidanceLog[] }>('/guidance-logs/batch', { logs });
      return appendStoredGuidanceLogs(
        data.logs.map((log) => ({ ...log, id: log.id || log._id || makeId('log') })),
      );
    },
    fallbackCall: () => appendStoredGuidanceLogs(logs.map((log) => ({ ...log, id: log.id || makeId('log') }))),
  });
}

export async function getGuidanceLogsApi(sessionId?: string) {
  return getStoredGuidanceLogs(sessionId);
}
