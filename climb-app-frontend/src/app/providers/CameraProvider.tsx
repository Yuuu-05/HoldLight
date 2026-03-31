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
import { requestCameraStream } from '../../shared/lib/camera';

interface CameraState {
  stream: MediaStream | null;
  supported: boolean;
  requestAccess: () => Promise<MediaStream | null>;
  stopStream: () => void;
}

const CameraContext = createContext<CameraState | null>(null);

export default function CameraProvider({ children }: PropsWithChildren) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingRequestRef = useRef<Promise<MediaStream | null> | null>(null);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const releaseStream = useCallback((target: MediaStream | null) => {
    target?.getTracks().forEach((track) => track.stop());
  }, []);

  const requestAccess = useCallback(async () => {
    const currentStream = streamRef.current;
    const currentVideoTrack = currentStream?.getVideoTracks()[0];

    if (currentStream && currentStream.active && currentVideoTrack?.readyState === 'live') {
      return currentStream;
    }

    if (pendingRequestRef.current) {
      return pendingRequestRef.current;
    }

    const pendingRequest = (async () => {
      try {
        const nextStream = await requestCameraStream();
        const previousStream = streamRef.current;

        if (previousStream && previousStream !== nextStream) {
          releaseStream(previousStream);
        }

        streamRef.current = nextStream;
        setStream(nextStream);
        return nextStream;
      } catch {
        return null;
      } finally {
        pendingRequestRef.current = null;
      }
    })();

    pendingRequestRef.current = pendingRequest;
    return pendingRequest;
  }, [releaseStream]);

  const stopStream = useCallback(() => {
    pendingRequestRef.current = null;
    releaseStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, [releaseStream]);

  useEffect(() => () => releaseStream(streamRef.current), [releaseStream]);

  const value = useMemo<CameraState>(
    () => ({
      stream,
      supported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
      requestAccess,
      stopStream,
    }),
    [requestAccess, stopStream, stream],
  );

  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) throw new Error('useCamera must be used within CameraProvider');
  return context;
}
