import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  getCameraErrorMessage,
  getCameraErrorReason,
  getCameraFacingMode,
  isClearlyFrontCameraStream,
  requestCameraStream,
  type CameraFailureReason,
  type CameraFacingMode,
  type CameraFacingState,
  type CameraRequestOptions,
} from '../../shared/lib/camera';

interface CameraState {
  stream: MediaStream | null;
  supported: boolean;
  activeFacingMode: CameraFacingState;
  cameraError: string | null;
  cameraErrorReason: CameraFailureReason | null;
  cameraNotice: string | null;
  requestAccess: (options?: CameraRequestOptions) => Promise<MediaStream | null>;
  switchCamera: () => Promise<MediaStream | null>;
  stopStream: () => void;
}

const CameraContext = createContext<CameraState | null>(null);

export default function CameraProvider({ children }: PropsWithChildren) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeFacingMode, setActiveFacingMode] = useState<CameraFacingState>('unknown');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraErrorReason, setCameraErrorReason] = useState<CameraFailureReason | null>(null);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeFacingModeRef = useRef<CameraFacingState>('unknown');
  const pendingRequestRef = useRef<Promise<MediaStream | null> | null>(null);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    activeFacingModeRef.current = activeFacingMode;
  }, [activeFacingMode]);

  const releaseStream = useCallback((target: MediaStream | null) => {
    target?.getTracks().forEach((track) => track.stop());
  }, []);

  const requestAccess = useCallback(async (options: CameraRequestOptions = {}) => {
    const preferredFacingMode = options.preferredFacingMode ?? 'environment';
    const currentStream = streamRef.current;
    const currentVideoTrack = currentStream?.getVideoTracks()[0];
    const currentFacingMode = activeFacingModeRef.current !== 'unknown'
      ? activeFacingModeRef.current
      : getCameraFacingMode(currentStream);
    const canReuseCurrentStream = Boolean(
      currentStream &&
      currentStream.active &&
      currentVideoTrack?.readyState === 'live' &&
      !options.forceNew &&
      (
        currentFacingMode === preferredFacingMode ||
        currentFacingMode === 'unknown' ||
        (preferredFacingMode === 'environment' && !isClearlyFrontCameraStream(currentStream))
      ),
    );

    if (canReuseCurrentStream) {
      setCameraError(null);
      setCameraErrorReason(null);
      return currentStream;
    }

    if (pendingRequestRef.current) {
      return pendingRequestRef.current;
    }

    const pendingRequest = (async () => {
      if (currentStream && options.forceNew) {
        releaseStream(currentStream);
        streamRef.current = null;
        activeFacingModeRef.current = 'unknown';
        setStream(null);
        setActiveFacingMode('unknown');
      }

      setCameraError(null);
      setCameraErrorReason(null);
      setCameraNotice(null);

      try {
        const result = await requestCameraStream({
          ...options,
          preferredFacingMode,
        });
        const nextStream = result.stream;
        const previousStream = streamRef.current;

        if (previousStream && previousStream !== nextStream) {
          releaseStream(previousStream);
        }

        streamRef.current = nextStream;
        activeFacingModeRef.current = result.facingMode;
        setStream(nextStream);
        setActiveFacingMode(result.facingMode);
        setCameraNotice(
          result.usedFallback && preferredFacingMode === 'environment'
            ? 'Rear camera was not available. Using the available camera instead.'
            : null,
        );
        setCameraError(null);
        setCameraErrorReason(null);
        return nextStream;
      } catch (error) {
        setCameraNotice(null);
        setCameraErrorReason(getCameraErrorReason(error));
        setCameraError(getCameraErrorMessage(error));
        return null;
      } finally {
        pendingRequestRef.current = null;
      }
    })();

    pendingRequestRef.current = pendingRequest;
    return pendingRequest;
  }, [releaseStream]);

  const switchCamera = useCallback(async () => {
    const currentFacingMode = activeFacingModeRef.current !== 'unknown'
      ? activeFacingModeRef.current
      : getCameraFacingMode(streamRef.current);
    const nextFacingMode: CameraFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

    return requestAccess({
      preferredFacingMode: nextFacingMode,
      forceNew: true,
      allowFallback: true,
    });
  }, [requestAccess]);

  const stopStream = useCallback(() => {
    pendingRequestRef.current = null;
    releaseStream(streamRef.current);
    streamRef.current = null;
    activeFacingModeRef.current = 'unknown';
    setStream(null);
    setActiveFacingMode('unknown');
    setCameraError(null);
    setCameraErrorReason(null);
    setCameraNotice(null);
  }, [releaseStream]);

  useEffect(() => () => releaseStream(streamRef.current), [releaseStream]);

  const value = useMemo<CameraState>(
    () => ({
      stream,
      supported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
      activeFacingMode,
      cameraError,
      cameraErrorReason,
      cameraNotice,
      requestAccess,
      switchCamera,
      stopStream,
    }),
    [activeFacingMode, cameraError, cameraErrorReason, cameraNotice, requestAccess, stopStream, stream, switchCamera],
  );

  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) throw new Error('useCamera must be used within CameraProvider');
  return context;
}
