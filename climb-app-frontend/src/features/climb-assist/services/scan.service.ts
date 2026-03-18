import type { ClimbScan, CreateClimbScanPayload, WallMap } from '../../../shared/types/climb';
import { buildDemoWallMap } from '../mock/demoWallMap';

export function buildScanPayload(source: 'camera' | 'demo' = 'demo', gymName = 'Campus climbing gym'): CreateClimbScanPayload {
  const wallMap = buildDemoWallMap(source);
  return {
    gymName,
    availableColors: wallMap.colors,
    wallMap,
  };
}

export function buildScanPayloadFromWallMap(
  wallMap: WallMap,
  gymName = 'Campus climbing gym',
  coverImageUrl?: string,
): CreateClimbScanPayload {
  return {
    gymName,
    availableColors: wallMap.colors,
    wallMap,
    coverImageUrl,
  };
}

export function createLocalScanRecord(payload: CreateClimbScanPayload): ClimbScan {
  return {
    id: `scan_${Date.now()}`,
    gymName: payload.gymName,
    availableColors: payload.availableColors,
    wallMap: payload.wallMap,
    coverImageUrl: payload.coverImageUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getWallMapCoverage(wallMap: WallMap) {
  return {
    holdCount: wallMap.holds.length,
    colorCount: wallMap.colors.length,
    source: wallMap.source,
  };
}
