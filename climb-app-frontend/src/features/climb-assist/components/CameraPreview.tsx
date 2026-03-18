import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface CameraPreviewProps {
  stream: MediaStream | null;
  label?: string;
  videoRef?: RefObject<HTMLVideoElement>;
  children?: ReactNode;
}

export default function CameraPreview({ stream, label = 'Rear camera preview', videoRef, children }: CameraPreviewProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = videoRef ?? internalVideoRef;

  useEffect(() => {
    if (activeVideoRef.current && stream) {
      activeVideoRef.current.srcObject = stream;
    }
  }, [activeVideoRef, stream]);

  return stream ? (
    <div className="stack-sm">
      <div className="camera-preview-shell">
        <video className="camera-preview" ref={activeVideoRef} autoPlay playsInline muted />
        {children}
      </div>
      <p className="subtle-text">{label}</p>
    </div>
  ) : (
    <div className="camera-placeholder">Camera preview will appear here when permission is granted.</div>
  );
}
