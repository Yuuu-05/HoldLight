import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

interface CameraPreviewProps {
  stream: MediaStream | null;
  label?: string;
  videoRef?: RefObject<HTMLVideoElement>;
  children?: ReactNode;
  className?: string;
}

export default function CameraPreview({
  stream,
  label = 'Rear camera preview',
  videoRef,
  children,
  className = '',
}: CameraPreviewProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = videoRef ?? internalVideoRef;
  const captionId = useId();

  useEffect(() => {
    if (activeVideoRef.current && stream) {
      activeVideoRef.current.srcObject = stream;
    }
  }, [activeVideoRef, stream]);

  return stream ? (
    <figure className={`stack-sm ${className}`.trim()}>
      <div className="camera-preview-shell camera-container">
        <video className="camera-preview" ref={activeVideoRef} autoPlay playsInline muted aria-label={label} aria-describedby={captionId} />
        <div className="camera-preview-mask" aria-hidden="true">
          <span className="camera-preview-mask-frame" />
          <span className="camera-preview-mask-pill" />
        </div>
        {children}
      </div>
      <figcaption id={captionId} className="subtle-text camera-preview-caption">
        {label}
      </figcaption>
    </figure>
  ) : (
    <div className="camera-placeholder camera-placeholder-assist" role="note">
      Camera preview will appear here when permission is granted.
    </div>
  );
}
