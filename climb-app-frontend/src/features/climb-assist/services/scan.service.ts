import type { CreateClimbScanPayload, WallMap } from '../../../shared/types/climb';

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

export function getWallMapCoverage(wallMap: WallMap) {
  return {
    holdCount: wallMap.holds.length,
    colorCount: wallMap.colors.length,
    source: wallMap.source,
  };
}
