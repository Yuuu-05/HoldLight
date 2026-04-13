const REAR_CAMERA_LABEL_PATTERN = /\b(back|rear|environment|world)\b|后置|背面|后面/i;
const FRONT_CAMERA_LABEL_PATTERN = /\b(front|user|face|facetime|selfie)\b|前置|自拍/i;

function classifyCameraFacing(track: MediaStreamTrack | null | undefined) {
  if (!track) return 'unknown' as const;

  const facingMode = track.getSettings().facingMode;
  if (facingMode === 'environment') return 'environment' as const;
  if (facingMode === 'user') return 'user' as const;

  const label = track.label ?? '';
  if (REAR_CAMERA_LABEL_PATTERN.test(label)) return 'environment' as const;
  if (FRONT_CAMERA_LABEL_PATTERN.test(label)) return 'user' as const;

  return 'unknown' as const;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function findRearCameraDeviceId() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return null;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const rearCamera = devices.find(
      (device) => device.kind === 'videoinput' && REAR_CAMERA_LABEL_PATTERN.test(device.label),
    );

    return rearCamera?.deviceId ?? null;
  } catch {
    return null;
  }
}

export function isClearlyFrontCameraStream(stream: MediaStream | null) {
  const videoTrack = stream?.getVideoTracks()[0] ?? null;
  return classifyCameraFacing(videoTrack) === 'user';
}

export async function requestCameraStream() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported in this browser.');
  }

  const preferredAttempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1920 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { exact: 'environment' },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
      },
      audio: false,
    },
  ];

  const genericAttempts: MediaStreamConstraints[] = [
    {
      video: {
        width: { ideal: 1920 },
      },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown = null;
  let fallbackStream: MediaStream | null = null;

  const rememberFallbackStream = (stream: MediaStream) => {
    if (!fallbackStream) {
      fallbackStream = stream;
      return;
    }

    stopStream(stream);
  };

  for (const constraints of preferredAttempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!isClearlyFrontCameraStream(stream)) {
        return stream;
      }

      rememberFallbackStream(stream);
    } catch (error) {
      lastError = error;
    }
  }

  const rearCameraDeviceId = await findRearCameraDeviceId();
  if (rearCameraDeviceId) {
    const rearDeviceAttempts: MediaStreamConstraints[] = [
      {
        video: {
          deviceId: { exact: rearCameraDeviceId },
          width: { ideal: 1920 },
        },
        audio: false,
      },
      {
        video: {
          deviceId: { exact: rearCameraDeviceId },
        },
        audio: false,
      },
    ];

    for (const constraints of rearDeviceAttempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
      }
    }
  }

  for (const constraints of genericAttempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!isClearlyFrontCameraStream(stream)) {
        return stream;
      }

      rememberFallbackStream(stream);
    } catch (error) {
      lastError = error;
    }
  }

  if (fallbackStream) {
    return fallbackStream;
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to start the camera stream.');
}
