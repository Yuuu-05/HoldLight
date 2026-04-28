import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface CameraPreviewProps {
  stream: MediaStream | null;
  label?: string;
  videoRef?: RefObject<HTMLVideoElement>;
  onVideoReady?: (element: HTMLVideoElement | null) => void;
  children?: ReactNode;
  className?: string;
  plainLiveView?: boolean;
  syncAspectRatio?: boolean;
  fixedAspectRatio?: string;
  fallbackAspectRatio?: string;
  fitWithinContainer?: boolean;
  showMask?: boolean;
  showCaption?: boolean;
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

function readAspectRatio(video: HTMLVideoElement, stream: MediaStream | null) {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return `${video.videoWidth} / ${video.videoHeight}`;
  }

  const settings = stream?.getVideoTracks()[0]?.getSettings();
  if (settings?.width && settings?.height) {
    return `${settings.width} / ${settings.height}`;
  }

  if (settings?.aspectRatio && Number.isFinite(settings.aspectRatio) && settings.aspectRatio > 0) {
    return String(settings.aspectRatio);
  }

  return null;
}

function parseAspectRatioValue(value: string | null | undefined) {
  if (!value) return null;

  const ratioParts = value.split('/').map((part) => Number(part.trim()));
  if (
    ratioParts.length === 2 &&
    Number.isFinite(ratioParts[0]) &&
    Number.isFinite(ratioParts[1]) &&
    ratioParts[0] > 0 &&
    ratioParts[1] > 0
  ) {
    return ratioParts[0] / ratioParts[1];
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

export default function CameraPreview({
  stream,
  label,
  videoRef,
  onVideoReady,
  children,
  className = '',
  plainLiveView = false,
  syncAspectRatio = false,
  fixedAspectRatio,
  fallbackAspectRatio = '4 / 3',
  fitWithinContainer = false,
  showMask,
  showCaption = false,
}: CameraPreviewProps) {
  const { t } = useLanguage();
  const previewLabel = label ?? t('Rear camera preview');
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = videoRef ?? internalVideoRef;
  const fitWrapperRef = useRef<HTMLElement | null>(null);
  const captionId = useId();
  const [hasFrames, setHasFrames] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string | null>(null);
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null);

  const showPreviewMask = showMask ?? !plainLiveView;
  const shouldUseAspectRatio = syncAspectRatio || Boolean(fixedAspectRatio);
  const shouldFitWithinContainer = shouldUseAspectRatio && (plainLiveView || fitWithinContainer);
  const effectiveAspectRatio = shouldUseAspectRatio ? fixedAspectRatio ?? aspectRatio ?? fallbackAspectRatio : undefined;
  const effectiveAspectRatioValue = parseAspectRatioValue(effectiveAspectRatio);

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
      const nextAspectRatio = readAspectRatio(video, stream);
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

      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.disablePictureInPicture = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');

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

  useEffect(() => {
    if (!shouldFitWithinContainer || !effectiveAspectRatioValue) {
      setFitSize(null);
      return undefined;
    }

    const wrapper = fitWrapperRef.current;
    if (!wrapper) return undefined;

    const updateFitSize = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const availableRatio = rect.width / rect.height;
      const nextSize = availableRatio > effectiveAspectRatioValue
        ? {
            width: rect.height * effectiveAspectRatioValue,
            height: rect.height,
          }
        : {
            width: rect.width,
            height: rect.width / effectiveAspectRatioValue,
          };

      setFitSize((current) => {
        if (
          current &&
          Math.abs(current.width - nextSize.width) < 0.5 &&
          Math.abs(current.height - nextSize.height) < 0.5
        ) {
          return current;
        }
        return nextSize;
      });
    };

    updateFitSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFitSize);
      return () => window.removeEventListener('resize', updateFitSize);
    }

    const observer = new ResizeObserver(updateFitSize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [effectiveAspectRatioValue, shouldFitWithinContainer]);

  if (!stream) {
    return (
      <div className="camera-placeholder camera-placeholder-assist" role="note">
        {t('Camera preview will appear here when permission is granted.')}
      </div>
    );
  }

  const fittedShellStyle: CSSProperties | undefined = shouldFitWithinContainer
    ? {
        width: fitSize ? `${fitSize.width}px` : '100%',
        height: fitSize ? `${fitSize.height}px` : undefined,
        maxWidth: '100%',
        maxHeight: '100%',
        justifySelf: fitSize ? 'center' : undefined,
        alignSelf: fitSize ? 'center' : undefined,
        aspectRatio: effectiveAspectRatio,
      }
    : undefined;

  const shellStyle: CSSProperties | undefined = plainLiveView
    ? {
        ...fittedShellStyle,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '32px',
        background: '#111827',
        boxShadow: 'none',
        isolation: 'isolate',
        contain: 'paint',
      }
    : fitWithinContainer
      ? fittedShellStyle
    : shouldUseAspectRatio
      ? {
          width: '100%',
          aspectRatio: effectiveAspectRatio,
        }
      : undefined;

  const previewStyle: CSSProperties | undefined = plainLiveView
    ? {
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: '#111827',
        filter: 'none',
        opacity: hasFrames ? 1 : 0.001,
        transition: 'opacity 140ms linear',
        aspectRatio: effectiveAspectRatio,
      }
    : shouldUseAspectRatio
      ? {
          width: '100%',
          height: '100%',
          minHeight: 0,
          aspectRatio: effectiveAspectRatio,
        }
      : undefined;

  return (
    <figure
      ref={(element) => {
        fitWrapperRef.current = element;
      }}
      className={`stack-sm ${className}`.trim()}
      style={shouldFitWithinContainer ? {
        width: '100%',
        height: '100%',
        minHeight: 0,
        justifyItems: 'center',
        alignItems: 'center',
      } : undefined}
    >
      <div
        className={
          plainLiveView
            ? 'camera-preview-shell camera-container assist-live-plain-shell'
            : 'camera-preview-shell camera-container'
        }
        style={shellStyle}
      >
        <video
          className="camera-preview"
          ref={activeVideoRef}
          autoPlay
          playsInline
          muted
          disablePictureInPicture
          aria-label={previewLabel}
          aria-describedby={showCaption ? captionId : undefined}
          style={previewStyle}
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
            {t('Starting live camera...')}
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
      {showCaption ? (
        <figcaption id={captionId} className="subtle-text camera-preview-caption">
          {previewLabel}
        </figcaption>
      ) : null}
    </figure>
  );
}
