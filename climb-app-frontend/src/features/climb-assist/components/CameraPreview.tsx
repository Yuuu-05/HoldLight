import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

interface CameraPreviewProps {
  stream: MediaStream | null;
  label?: string;
  videoRef?: RefObject<HTMLVideoElement>;
  onVideoReady?: (element: HTMLVideoElement | null) => void;
  children?: ReactNode;
  className?: string;
  plainLiveView?: boolean;
  syncAspectRatio?: boolean;
  showMask?: boolean;
}

type VideoElementWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function hasRenderableFrame(video: HTMLVideoElement, stream: MediaStream | null) {
  if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return true;
  }

  if (typeof video.getVideoPlaybackQuality === 'function') {
    const quality = video.getVideoPlaybackQuality();
    if ((quality.totalVideoFrames ?? 0) > 0 || (quality.droppedVideoFrames ?? 0) > 0) {
      return true;
    }
  }

  const videoTrack = stream?.getVideoTracks()[0];
  return Boolean(
    videoTrack &&
      videoTrack.readyState === 'live' &&
      !videoTrack.muted &&
      video.videoWidth > 0 &&
      video.videoHeight > 0,
  );
}

function readAspectRatio(video: HTMLVideoElement) {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;
  return `${video.videoWidth} / ${video.videoHeight}`;
}

export default function CameraPreview({
  stream,
  label = 'Rear camera preview',
  videoRef,
  onVideoReady,
  children,
  className = '',
  plainLiveView = false,
  syncAspectRatio = false,
  showMask,
}: CameraPreviewProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = videoRef ?? internalVideoRef;
  const captionId = useId();
  const [hasFrames, setHasFrames] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string | null>(null);

  const showPreviewMask = showMask ?? !plainLiveView;

  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    if (!stream) {
      setHasFrames(false);
      setAspectRatio(null);
      return;
    }

    setHasFrames(false);

    let cancelled = false;
    let fallbackTimerId: number | null = null;
    let rafId: number | null = null;
    let frameCallbackId: number | null = null;
    const frameCallbackVideo = video as VideoElementWithFrameCallback;
    const videoTrack = stream.getVideoTracks()[0] ?? null;

    const syncVideoAspectRatio = () => {
      if (!syncAspectRatio) return;
      const nextAspectRatio = readAspectRatio(video);
      if (nextAspectRatio) {
        setAspectRatio(nextAspectRatio);
      }
    };

    const markReady = () => {
      if (cancelled) return;
      syncVideoAspectRatio();
      setHasFrames(true);
    };

    const inspectFrame = () => {
      if (cancelled) return;
      syncVideoAspectRatio();
      if (hasRenderableFrame(video, stream)) {
        markReady();
        return;
      }

      rafId = window.requestAnimationFrame(inspectFrame);
    };

    const handleResize = () => {
      syncVideoAspectRatio();
      if (hasRenderableFrame(video, stream)) {
        markReady();
      }
    };

    video.addEventListener('loadedmetadata', handleResize);
    video.addEventListener('loadeddata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('playing', markReady);
    video.addEventListener('resize', handleResize);
    videoTrack?.addEventListener('unmute', markReady);

    syncVideoAspectRatio();

    if (hasRenderableFrame(video, stream)) {
      markReady();
    } else {
      rafId = window.requestAnimationFrame(inspectFrame);
      fallbackTimerId = window.setTimeout(() => {
        if (hasRenderableFrame(video, stream)) {
          markReady();
        }
      }, 1400);

      if (frameCallbackVideo.requestVideoFrameCallback) {
        frameCallbackId = frameCallbackVideo.requestVideoFrameCallback(markReady);
      }
    }

    return () => {
      cancelled = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (fallbackTimerId !== null) {
        window.clearTimeout(fallbackTimerId);
      }
      if (frameCallbackId !== null && frameCallbackVideo.cancelVideoFrameCallback) {
        frameCallbackVideo.cancelVideoFrameCallback(frameCallbackId);
      }
      video.removeEventListener('loadedmetadata', handleResize);
      video.removeEventListener('loadeddata', markReady);
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('playing', markReady);
      video.removeEventListener('resize', handleResize);
      videoTrack?.removeEventListener('unmute', markReady);
    };
  }, [activeVideoRef, stream, syncAspectRatio]);

  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }

      video.muted = true;
      video.playsInline = true;

      const tryPlay = async () => {
        try {
          await video.play();
        } catch {
          // autoplay may be delayed; events above will retry readiness once frames arrive
        }
      };

      void tryPlay();
    } else {
      video.srcObject = null;
      setHasFrames(false);
    }
  }, [activeVideoRef, stream]);

  useEffect(() => {
    onVideoReady?.(activeVideoRef.current);
    return () => onVideoReady?.(null);
  }, [activeVideoRef, onVideoReady]);

  if (!stream) {
    return (
      <div className="camera-placeholder camera-placeholder-assist" role="note">
        Camera preview will appear here when permission is granted.
      </div>
    );
  }

  const plainShellStyle: CSSProperties | undefined = plainLiveView
    ? {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '32px',
        background: '#111827',
        boxShadow: 'none',
        isolation: 'isolate',
        contain: 'paint',
        aspectRatio: syncAspectRatio ? aspectRatio ?? undefined : undefined,
      }
    : undefined;

  const plainVideoStyle: CSSProperties | undefined = plainLiveView
    ? {
        background: '#111827',
        filter: 'none',
        opacity: hasFrames ? 1 : 0.001,
        transition: 'opacity 140ms linear',
        aspectRatio: syncAspectRatio ? aspectRatio ?? undefined : undefined,
      }
    : undefined;

  return (
    <figure className={`stack-sm ${className}`.trim()}>
      <div
        className={
          plainLiveView
            ? 'camera-preview-shell camera-container assist-live-plain-shell'
            : 'camera-preview-shell camera-container'
        }
        style={plainShellStyle}
      >
        <video
          className="camera-preview"
          ref={activeVideoRef}
          autoPlay
          playsInline
          muted
          aria-label={label}
          aria-describedby={captionId}
          style={plainVideoStyle}
        />

        {plainLiveView && !hasFrames ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              zIndex: 2,
              transform: 'translateX(-50%)',
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              background: 'rgba(15,23,42,0.72)',
              color: 'rgba(255,255,255,0.92)',
              fontSize: '0.84rem',
              fontWeight: 600,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            Starting live camera…
          </div>
        ) : null}

        {showPreviewMask ? (
          <div className="camera-preview-mask" aria-hidden="true">
            <span className="camera-preview-mask-frame" />
            <span className="camera-preview-mask-pill" />
          </div>
        ) : null}

        {children}
      </div>
      <figcaption id={captionId} className="subtle-text camera-preview-caption">
        {label}
      </figcaption>
    </figure>
  );
}
