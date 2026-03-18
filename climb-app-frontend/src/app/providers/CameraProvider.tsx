import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
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

  const value = useMemo<CameraState>(
    () => ({
      stream,
      supported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
      requestAccess: async () => {
        try {
          const nextStream = await requestCameraStream();
          setStream(nextStream);
          return nextStream;
        } catch {
          return null;
        }
      },
      stopStream: () => {
        stream?.getTracks().forEach((track) => track.stop());
        setStream(null);
      },
    }),
    [stream],
  );

  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) throw new Error('useCamera must be used within CameraProvider');
  return context;
}
