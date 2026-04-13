const MEDIAPIPE_POSE_RUNTIME_CANDIDATES = [
  {
    scriptId: 'mediapipe-pose-script-local',
    scriptUrl: '/vendor/mediapipe/pose/pose.js',
    assetBase: '/vendor/mediapipe/pose',
  },
  {
    scriptId: 'mediapipe-pose-script-jsdelivr',
    scriptUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
    assetBase: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
  },
  {
    scriptId: 'mediapipe-pose-script-unpkg',
    scriptUrl: 'https://unpkg.com/@mediapipe/pose/pose.js',
    assetBase: 'https://unpkg.com/@mediapipe/pose',
  },
] as const;

interface PoseLandmark {
  x: number;
  y: number;
  visibility?: number;
}

interface PoseResults {
  poseLandmarks?: PoseLandmark[];
}

type PoseInputImage = HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap;

interface PoseInstanceOptions {
  assetBase?: string;
  modelComplexity?: 0 | 1 | 2;
  selfieMode?: boolean;
  smoothLandmarks?: boolean;
  enableSegmentation?: boolean;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

declare global {
  interface Window {
    Pose?: new (config: { locateFile: (file: string) => string }) => {
      setOptions: (options: Record<string, unknown>) => void;
      onResults: (callback: (results: PoseResults) => void) => void;
      send: (input: { image: PoseInputImage }) => Promise<void>;
      close: () => void;
    };
  }
}

let poseScriptPromise: Promise<string> | null = null;
let resolvedPoseAssetBase: string = MEDIAPIPE_POSE_RUNTIME_CANDIDATES[0].assetBase;

function loadPoseScriptCandidate(scriptId: string, scriptUrl: string) {
  if (typeof document === 'undefined') {
    throw new Error('MediaPipe Pose can only load in the browser.');
  }

  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true' || window.Pose) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${scriptUrl}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load ${scriptUrl}`));
    };
    document.head.appendChild(script);
  });
}

export async function loadMediapipePoseScript() {
  if (typeof window === 'undefined') {
    throw new Error('MediaPipe Pose can only load in the browser.');
  }

  if (window.Pose) {
    return resolvedPoseAssetBase;
  }

  if (poseScriptPromise) {
    return poseScriptPromise;
  }

  poseScriptPromise = (async () => {
    let lastError: unknown;

    for (const candidate of MEDIAPIPE_POSE_RUNTIME_CANDIDATES) {
      try {
        await loadPoseScriptCandidate(candidate.scriptId, candidate.scriptUrl);
        if (window.Pose) {
          resolvedPoseAssetBase = candidate.assetBase;
          return resolvedPoseAssetBase;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to load MediaPipe Pose script.');
  })();

  try {
    const assetBase = await poseScriptPromise;

    if (!window.Pose) {
      throw new Error('MediaPipe Pose loaded, but the Pose runtime is unavailable.');
    }

    return assetBase;
  } catch (error) {
    poseScriptPromise = null;
    throw error;
  }
}

export function createPoseInstance(
  onResults: (results: PoseResults) => void,
  options: PoseInstanceOptions = {},
) {
  if (!window.Pose) {
    throw new Error('MediaPipe Pose is not ready yet.');
  }

  const { assetBase = resolvedPoseAssetBase, ...poseOptions } = options;
  const pose = new window.Pose({
    locateFile: (file) => `${assetBase}/${file}`,
  });

  pose.setOptions({
    modelComplexity: 2,
    selfieMode: false,
    smoothLandmarks: false,
    enableSegmentation: false,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.65,
    ...poseOptions,
  });
  pose.onResults(onResults);
  return pose;
}

export type { PoseLandmark, PoseResults };
