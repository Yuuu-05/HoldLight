import { apiClient } from './client';
import type { Hold, WallMap } from '../types/climb';

interface VisionInferenceRequest {
  imageDataUrl: string;
  source: 'camera' | 'upload';
  gymName?: string;
  filename?: string;
}

interface VisionInferenceResponse {
  success: boolean;
  result: {
    provider: string;
    availableColors: string[];
    routeCandidates: unknown[];
    wallMap: WallMap;
  };
}

export interface AlignmentPointPct {
  xPct: number;
  yPct: number;
}

export interface CalibratedHold extends Hold {
  projectedQuadPct?: AlignmentPointPct[];
  alignmentConfidence?: number;
}

export interface AlignmentWallMapPayload {
  holds: WallMap['holds'];
}

interface PlanarCalibrationRequest {
  referenceImageDataUrl: string;
  frameImageDataUrl: string;
  wallMap: AlignmentWallMapPayload;
}

interface PlanarCalibrationResponse {
  success: boolean;
  result: {
    provider: string;
    status: 'locked' | 'partial' | 'unavailable';
    message: string;
    qualityPct: number;
    detector: string;
    matchCount: number;
    inlierCount: number;
    inlierRatio: number;
    projectedReferenceQuadPct: AlignmentPointPct[];
    alignedHolds: CalibratedHold[];
    homography: number[];
  };
}

export async function runVisionFullApi(payload: VisionInferenceRequest) {
  const { data } = await apiClient.post<VisionInferenceResponse>('/vision/infer/full', payload, {
    timeout: 120000,
  });
  return data.result;
}

export async function runVisionPlanarCalibrationApi(payload: PlanarCalibrationRequest) {
  const { data } = await apiClient.post<PlanarCalibrationResponse>('/vision/calibrate/planar', payload, {
    timeout: 120000,
  });
  return data.result;
}
