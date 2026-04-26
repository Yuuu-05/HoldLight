export type CameraFacingMode = 'environment' | 'user';
export type CameraFacingState = CameraFacingMode | 'unknown';
export type CameraFailureReason =
  | 'unsupported'
  | 'permission-denied'
  | 'not-found'
  | 'not-readable'
  | 'overconstrained'
  | 'security'
  | 'unknown';

export interface CameraRequestOptions {
  preferredFacingMode?: CameraFacingMode;
  forceNew?: boolean;
  allowFallback?: boolean;
}

export interface CameraStreamResult {
  stream: MediaStream;
  facingMode: CameraFacingState;
  usedFallback: boolean;
}

export class CameraRequestError extends Error {
  reason: CameraFailureReason;
  originalName?: string;

  constructor(reason: CameraFailureReason, message: string, originalName?: string) {
    super(message);
    this.name = 'CameraRequestError';
    this.reason = reason;
    this.originalName = originalName;
  }
}

const REAR_CAMERA_LABEL_PATTERN = /\b(back|rear|environment|world|wide|ultra wide)\b|后置|背面|后面/i;
const FRONT_CAMERA_LABEL_PATTERN = /\b(front|user|face|facetime|selfie)\b|前置|自拍/i;

function classifyCameraFacing(track: MediaStreamTrack | null | undefined): CameraFacingState {
  if (!track) return 'unknown';

  const facingMode = track.getSettings().facingMode;
  if (facingMode === 'environment') return 'environment';
  if (facingMode === 'user') return 'user';

  const label = track.label ?? '';
  if (REAR_CAMERA_LABEL_PATTERN.test(label)) return 'environment';
  if (FRONT_CAMERA_LABEL_PATTERN.test(label)) return 'user';

  return 'unknown';
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function getCameraReason(error: unknown): CameraFailureReason {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }

  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'permission-denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'not-found';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'not-readable';
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'overconstrained';
  if (name === 'SecurityError') return 'security';
  return 'unknown';
}

function normalizeCameraError(error: unknown): CameraRequestError {
  const reason = getCameraReason(error);
  const originalName = error instanceof DOMException || error instanceof Error ? error.name : undefined;

  const messageByReason: Record<CameraFailureReason, string> = {
    unsupported: 'Camera is not supported in this browser.',
    'permission-denied': 'Camera permission was denied. Enable camera access in browser settings and try again.',
    'not-found': 'No camera was found on this device.',
    'not-readable': 'Camera is already in use by another app or browser tab.',
    overconstrained: 'This camera could not satisfy the requested mobile video settings.',
    security: 'Camera access needs HTTPS or localhost on mobile browsers.',
    unknown: 'Unable to start the camera stream.',
  };

  return new CameraRequestError(reason, messageByReason[reason], originalName);
}

function mobileVideoSettings(
  facingMode?: CameraFacingMode,
  exactFacingMode = false,
  deviceId?: string,
): MediaTrackConstraints {
  const supportedConstraints = navigator.mediaDevices?.getSupportedConstraints?.() ?? {};
  const constraints: MediaTrackConstraints = {};

  if (supportedConstraints.width) {
    constraints.width = { ideal: 1280, max: 1920 };
  }

  if (supportedConstraints.height) {
    constraints.height = { ideal: 960, max: 1440 };
  }

  if (supportedConstraints.aspectRatio) {
    constraints.aspectRatio = { ideal: 4 / 3 };
  }

  if (supportedConstraints.frameRate) {
    constraints.frameRate = { ideal: 24, max: 30 };
  }

  if (deviceId) {
    constraints.deviceId = { exact: deviceId };
    return constraints;
  }

  if (facingMode) {
    constraints.facingMode = exactFacingMode ? { exact: facingMode } : { ideal: facingMode };
  }

  return constraints;
}

async function findCameraDeviceId(facingMode: CameraFacingMode) {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return null;
  }

  const pattern = facingMode === 'environment' ? REAR_CAMERA_LABEL_PATTERN : FRONT_CAMERA_LABEL_PATTERN;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const camera = devices.find(
      (device) => device.kind === 'videoinput' && pattern.test(device.label),
    );

    return camera?.deviceId ?? null;
  } catch {
    return null;
  }
}

function rememberFallbackStream(currentFallback: MediaStream | null, stream: MediaStream) {
  if (!currentFallback) {
    return stream;
  }

  stopStream(stream);
  return currentFallback;
}

export function getCameraFacingMode(stream: MediaStream | null): CameraFacingState {
  return classifyCameraFacing(stream?.getVideoTracks()[0] ?? null);
}

export function isClearlyFrontCameraStream(stream: MediaStream | null) {
  return getCameraFacingMode(stream) === 'user';
}

export function getCameraErrorMessage(error: unknown) {
  if (error instanceof CameraRequestError) return error.message;
  return normalizeCameraError(error).message;
}

export function getCameraErrorReason(error: unknown): CameraFailureReason {
  if (error instanceof CameraRequestError) return error.reason;
  return normalizeCameraError(error).reason;
}

export async function requestCameraStream(options: CameraRequestOptions = {}): Promise<CameraStreamResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraRequestError('unsupported', 'Camera is not supported in this browser.');
  }

  const preferredFacingMode = options.preferredFacingMode ?? 'environment';
  const allowFallback = options.allowFallback ?? true;
  const preferredAttempts: MediaStreamConstraints[] = [
    {
      video: mobileVideoSettings(preferredFacingMode, false),
      audio: false,
    },
    {
      video: mobileVideoSettings(preferredFacingMode, true),
      audio: false,
    },
    {
      video: {
        facingMode: { exact: preferredFacingMode },
      },
      audio: false,
    },
  ];

  const genericAttempts: MediaStreamConstraints[] = [
    {
      video: mobileVideoSettings(),
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown = null;
  let fallbackStream: MediaStream | null = null;

  for (const constraints of preferredAttempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const facingMode = getCameraFacingMode(stream);

      if (facingMode === preferredFacingMode || facingMode === 'unknown') {
        return {
          stream,
          facingMode,
          usedFallback: false,
        };
      }

      fallbackStream = rememberFallbackStream(fallbackStream, stream);
    } catch (error) {
      if (getCameraReason(error) === 'permission-denied' || getCameraReason(error) === 'security') {
        throw normalizeCameraError(error);
      }
      lastError = error;
    }
  }

  const preferredDeviceId = await findCameraDeviceId(preferredFacingMode);
  if (preferredDeviceId) {
    const deviceAttempts: MediaStreamConstraints[] = [
      {
        video: mobileVideoSettings(undefined, false, preferredDeviceId),
        audio: false,
      },
      {
        video: {
          deviceId: { exact: preferredDeviceId },
        },
        audio: false,
      },
    ];

    for (const constraints of deviceAttempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return {
          stream,
          facingMode: getCameraFacingMode(stream),
          usedFallback: false,
        };
      } catch (error) {
        if (getCameraReason(error) === 'permission-denied' || getCameraReason(error) === 'security') {
          throw normalizeCameraError(error);
        }
        lastError = error;
      }
    }
  }

  if (allowFallback) {
    for (const constraints of genericAttempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const facingMode = getCameraFacingMode(stream);

        if (facingMode === preferredFacingMode || facingMode === 'unknown') {
          return {
            stream,
            facingMode,
            usedFallback: false,
          };
        }

        fallbackStream = rememberFallbackStream(fallbackStream, stream);
      } catch (error) {
        if (getCameraReason(error) === 'permission-denied' || getCameraReason(error) === 'security') {
          throw normalizeCameraError(error);
        }
        lastError = error;
      }
    }
  }

  if (fallbackStream && allowFallback) {
    return {
      stream: fallbackStream,
      facingMode: getCameraFacingMode(fallbackStream),
      usedFallback: true,
    };
  }

  throw normalizeCameraError(lastError);
}
