import { apiClient } from './client';
import type { WallMap } from '../types/climb';

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

export async function runVisionFullApi(payload: VisionInferenceRequest) {
  const { data } = await apiClient.post<VisionInferenceResponse>('/vision/infer/full', payload, {
    timeout: 120000,
  });
  return data.result;
}
