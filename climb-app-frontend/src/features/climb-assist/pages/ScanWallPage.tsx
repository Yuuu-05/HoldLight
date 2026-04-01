import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../../../app/providers/CameraProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { triggerHaptic } from '../../../shared/lib/haptics';
import type { ClimbScan } from '../../../shared/types/climb';
import AssistMascotSticker from '../components/AssistMascotSticker';
import CameraPreview from '../components/CameraPreview';
import RouteCanvas from '../components/RouteCanvas';
import ScanPermissionNotice from '../components/ScanPermissionNotice';
import { useScanSession } from '../hooks/useScanSession';
import { getWallMapCoverage } from '../services/scan.service';
import { buildScanSafetyDecision } from '../services/safetyState.service';

function createObjectUrlFromDataUrl(dataUrl: string) {
  const [header, encoded] = dataUrl.split(',', 2);
  if (!header || !encoded) {
    return null;
  }

  const mimeMatch = header.match(/^data:([^;]+);base64$/);
  const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export default function ScanWallPage() {
  const { supported, stream, requestAccess } = useCamera();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { scanProgress, latestScan, startScan } = useScanSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const uploadImageRef = useRef<HTMLImageElement>(null);
  const uploadVideoRef = useRef<HTMLVideoElement>(null);
  const [activeScan, setActiveScan] = useState<ClimbScan | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);
  const [showRecognitionDetails, setShowRecognitionDetails] = useState(false);
  const [overlayPreviewUrl, setOverlayPreviewUrl] = useState<string | null>(null);
  const hasSecureContext = typeof window === 'undefined' ? true : window.isSecureContext;
  const scanBusy = scanProgress.status === 'scanning' || scanProgress.status === 'saving';
  const previousScanStatusRef = useRef(scanProgress.status);

  usePageTitle('Assist');

  useEffect(() => {
    if (!latestScan) return;
    setActiveScan(latestScan);
  }, [latestScan]);

  useEffect(() => {
    if (scanProgress.status === 'done' && previousScanStatusRef.current !== 'done') {
      triggerHaptic(18);
    }
    previousScanStatusRef.current = scanProgress.status;
  }, [scanProgress.status]);

  useEffect(() => {
    let generatedObjectUrl: string | null = null;

    const source = activeScan?.wallMap.source ?? latestScan?.wallMap.source;
    const coverImageUrl = activeScan?.coverImageUrl ?? latestScan?.coverImageUrl ?? null;

    if (source === 'upload' && uploadType === 'image' && uploadPreviewUrl) {
      setOverlayPreviewUrl(uploadPreviewUrl);
      return () => undefined;
    }

    if (!coverImageUrl) {
      setOverlayPreviewUrl(null);
      return () => undefined;
    }

    if (!coverImageUrl.startsWith('data:image/')) {
      setOverlayPreviewUrl(coverImageUrl);
      return () => undefined;
    }

    generatedObjectUrl = createObjectUrlFromDataUrl(coverImageUrl);
    setOverlayPreviewUrl(generatedObjectUrl ?? coverImageUrl);

    return () => {
      if (generatedObjectUrl) {
        URL.revokeObjectURL(generatedObjectUrl);
      }
    };
  }, [
    activeScan?.coverImageUrl,
    activeScan?.wallMap.source,
    latestScan?.coverImageUrl,
    latestScan?.wallMap.source,
    uploadPreviewUrl,
    uploadType,
  ]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
    };
  }, [uploadPreviewUrl]);

  async function ensureCameraPreviewReady(nextStream?: MediaStream | null) {
    const videoElement = videoRef.current;
    if (!videoElement) return false;

    if (nextStream && videoElement.srcObject !== nextStream) {
      videoElement.srcObject = nextStream;
    }

    const hasFrame = () => videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
    if (hasFrame()) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        videoElement.removeEventListener('loadedmetadata', handleReady);
        videoElement.removeEventListener('canplay', handleReady);
        videoElement.removeEventListener('playing', handleReady);
      };

      const finish = (ready: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(ready);
      };

      const handleReady = () => {
        void videoElement.play().catch(() => undefined);
        window.requestAnimationFrame(() => finish(hasFrame()));
      };

      const timeoutId = window.setTimeout(() => finish(hasFrame()), 1500);

      videoElement.addEventListener('loadedmetadata', handleReady);
      videoElement.addEventListener('canplay', handleReady);
      videoElement.addEventListener('playing', handleReady);
      if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
        handleReady();
        return;
      }
      void videoElement.play().catch(() => undefined);
    });
  }

  async function handleScan(source: 'camera' | 'demo') {
    if (scanBusy) return;

    let activeStream = stream;

    if (source === 'camera' && supported && hasSecureContext && !stream) {
      activeStream = await requestAccess();
      if (!activeStream) return;
    }

    if (source === 'camera') {
      const previewReady = await ensureCameraPreviewReady(activeStream);
      if (!previewReady) return;
    }

    const scan = await startScan({
      source,
      gymName: 'Campus climbing gym',
      videoElement: videoRef.current,
    });

    if (scan) {
      setActiveScan(scan);
    }
  }

  async function handleUploadScan() {
    if (!uploadType || scanBusy) return;

    const scan = await startScan({
      gymName: 'Campus climbing gym',
      imageElement: uploadImageRef.current,
      uploadedVideoElement: uploadVideoRef.current,
      uploadType,
    });

    if (scan) {
      setActiveScan(scan);
    }
  }

  function handleUploadSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextType = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('image/')
        ? 'image'
        : null;

    event.target.value = '';
    if (!nextType) return;

    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(nextUrl);
    setUploadName(file.name);
    setUploadType(nextType);
  }

  const displayScan = activeScan ?? latestScan;
  const scanCoverage = displayScan ? getWallMapCoverage(displayScan.wallMap) : null;
  const scanAnalysis = displayScan?.wallMap.analysis;
  const scanSafetyDecision = buildScanSafetyDecision(displayScan);
  const isReadyForAutonomousGuidance = displayScan ? scanSafetyDecision.canSelectRoute : false;
  const shouldSuggestVolunteer = Boolean(
    scanProgress.error
      || (displayScan && scanSafetyDecision.status !== 'ready'),
  );
  const fallbackDescription = scanProgress.error
    ? 'The wall is a little tricky right now. Try again with a steadier phone or brighter light.'
    : scanSafetyDecision.detail;
  const scanAnnouncement = scanProgress.status === 'error'
    ? `Scan paused. ${scanProgress.error ?? 'We could not finish this scan.'}`
    : scanProgress.message;
  const readinessHero = displayScan
    ? scanSafetyDecision.status === 'ready'
      ? {
          tone: 'ready',
          kicker: 'Small monkey says go',
          title: 'Your wall looks ready. Pick a route and start climbing.',
          body: 'The scan details are tucked away below if you want to verify them, but you can keep the momentum and move straight into route setup.',
          pose: 'celebrate' as const,
        }
      : scanSafetyDecision.status === 'companion'
        ? {
            tone: 'companion',
            kicker: 'Bring a buddy',
            title: 'Small monkey found a few route ideas, but this wall is better with a companion.',
            body: 'You can open the scan details if you want to inspect what was detected before deciding on the next step.',
            pose: 'nod' as const,
          }
        : {
            tone: 'retake',
            kicker: 'One more scan',
            title: 'Small monkey wants a cleaner wall photo before guiding this climb.',
            body: 'Retake the scan from a steadier angle or brighter light. The recognition details stay folded away unless you need them.',
            pose: 'tilt' as const,
          }
    : {
        tone: 'ready',
        kicker: 'Demo wall ready',
        title: 'Small monkey says this wall is ready for a fun first route.',
        body: 'Jump into route setup and let the climb start. You can always come back and rescan later.',
        pose: 'celebrate' as const,
      };

  useEffect(() => {
    setShowRecognitionDetails(false);
  }, [displayScan?.id]);

  return (
    <section className="stack-lg assist-shell">
      <Card title={t('Assist')} className="tone-blue assist-hero-card assist-scan-hero-card" bodyClassName="stack-md">
        <div className="assist-scan-intro">
          <p className="subtle-text">{t('Open the wall scanning flow to prepare climbing guidance.')}</p>
          <p className="assist-scan-note">
            Frame the whole wall like a sticker photo and keep the phone steady for a cleaner route match.
          </p>
        </div>
        <ScanPermissionNotice supported={supported} hasSecureContext={hasSecureContext} />
        <CameraPreview
          stream={stream}
          videoRef={videoRef}
          className="assist-camera-stage"
          label="A rounded polaroid-style live view for wall recognition."
        >
          {scanBusy ? (
            <div className="assist-camera-loader" role="status" aria-hidden="true">
              <div className="assist-camera-loader-card">
                <AssistMascotSticker variant="observe" className="assist-camera-loader-mascot" />
                <div className="stack-sm">
                  <strong>Small monkey is checking the wall map</strong>
                  <p>Hold the phone steady while route recognition finishes its pass.</p>
                </div>
              </div>
            </div>
          ) : null}
        </CameraPreview>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {scanAnnouncement}
        </div>
        <div className="inline-actions wrap assist-action-row">
          <Button onClick={() => void handleScan('camera')} disabled={!supported || !hasSecureContext || scanBusy}>
            Scan with camera
          </Button>
          <Button variant="secondary" onClick={() => void handleScan('demo')} disabled={scanBusy}>
            Use demo wall
          </Button>
        </div>
      </Card>

      <Card
        title="Upload a wall photo or video"
        className="tone-yellow assist-bottom-sheet assist-upload-sheet"
        bodyClassName="stack-md"
      >
        <p>
          Upload a wall photo, or pause a short video on a clear frame, and run the same recognition pipeline without using the live camera.
        </p>
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          onChange={handleUploadSelected}
        />
        <div className="inline-actions wrap">
          <Button variant="secondary" onClick={() => mediaInputRef.current?.click()} disabled={scanBusy}>
            Upload
          </Button>
          <Button onClick={() => void handleUploadScan()} disabled={!uploadType || scanBusy}>
            Scan uploaded media
          </Button>
        </div>
        {uploadType && uploadPreviewUrl ? (
          <div className="stack-sm">
            <p className="subtle-text">Selected file: {uploadName}</p>
            {uploadType === 'image' ? (
              <img ref={uploadImageRef} className="camera-preview" src={uploadPreviewUrl} alt="Uploaded wall preview" />
            ) : (
              <video ref={uploadVideoRef} className="camera-preview" src={uploadPreviewUrl} controls playsInline muted />
            )}
          </div>
        ) : (
          <div className="camera-placeholder camera-placeholder-assist">
            Upload a wall photo or video to test recognition without the live camera.
          </div>
        )}
      </Card>

      <Card title="Scan pulse" className="assist-bottom-sheet assist-status-sheet" bodyClassName="stack-md">
        <div className="assist-status-head">
          <p className="assist-status-copy">
            <strong>{scanProgress.message}</strong>
          </p>
          <span className="assist-status-progress">{scanProgress.progress}%</span>
        </div>
        <div
          className="assist-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={scanProgress.progress}
          aria-valuetext={scanProgress.message}
        >
          <span className="assist-progress-bar" style={{ width: `${scanProgress.progress}%` }} />
        </div>
        {shouldSuggestVolunteer ? (
          <div className="assist-soft-warning-card" role="note" aria-live="polite">
            <AssistMascotSticker variant="flashlight" className="assist-warning-mascot" />
            <div className="stack-sm">
              <strong>That wall is a little dim right now</strong>
              <p>{fallbackDescription}</p>
              <div className="inline-actions wrap">
                <Button onClick={() => navigate(routes.scanWall)}>Retake scan</Button>
              </div>
            </div>
          </div>
        ) : null}
        {scanCoverage ? (
          <div className="stats-grid">
            <div>
              <strong>{scanCoverage.holdCount}</strong>
              <span>Detected holds</span>
            </div>
            <div>
              <strong>{scanCoverage.colorCount}</strong>
              <span>Detected route colors</span>
            </div>
            <div>
              <strong>{scanCoverage.source}</strong>
              <span>Scan source</span>
            </div>
          </div>
        ) : null}
        {displayScan?.wallMap.scanNotes.length ? (
          <ol className="numbered-list subtle-text">
            {displayScan.wallMap.scanNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ol>
        ) : null}
      </Card>

      {displayScan ? (
        <Card title="Wall overlay preview" className="assist-stable-card" bodyClassName="stack-md">
          <RouteCanvas
            wallMap={displayScan.wallMap}
            backgroundImageUrl={overlayPreviewUrl ?? displayScan.coverImageUrl}
            plainImagePreview
            helperText="Original scan image with detected hold overlays. Use this view to verify the recognition result before choosing a route."
          />
        </Card>
      ) : null}

      {displayScan ? (
        <Card title="Route readiness" className="assist-bottom-sheet assist-readiness-sheet assist-stable-card" bodyClassName="stack-md">
          <div className={`assist-readiness-hero assist-readiness-hero-${readinessHero.tone}`.trim()}>
            <div className="assist-readiness-copy">
              <span className="assist-readiness-kicker">{readinessHero.kicker}</span>
              <div className="stack-sm">
                <strong>{readinessHero.title}</strong>
                <p>{readinessHero.body}</p>
              </div>
            </div>
            <div className="assist-readiness-mascot-shell" aria-hidden="true">
              <GuideMascot className="assist-readiness-mascot" pose={readinessHero.pose} />
            </div>
          </div>

          {scanAnalysis ? (
            <div className="stack-sm">
              <Button
                type="button"
                variant="ghost"
                className="assist-readiness-toggle"
                aria-expanded={showRecognitionDetails}
                aria-controls="scan-recognition-details"
                onClick={() => setShowRecognitionDetails((current) => !current)}
              >
                <span className="assist-readiness-toggle-copy">
                  <span className="assist-readiness-toggle-title">
                    {showRecognitionDetails ? 'Hide scan details' : 'See what the scan found'}
                  </span>
                  <span className="assist-readiness-toggle-hint">Recognition metrics and route candidates</span>
                </span>
                <span className="assist-readiness-toggle-icon" aria-hidden="true">
                  v
                </span>
              </Button>

              {showRecognitionDetails ? (
                <div id="scan-recognition-details" className="assist-readiness-details stack-md">
                  <div className="stats-grid">
                    <div>
                      <strong>{Math.round(scanAnalysis.confidence * 100)}%</strong>
                      <span>Overall confidence</span>
                    </div>
                    <div>
                      <strong>{scanAnalysis.detectionSummary.holdCount}</strong>
                      <span>Detected holds</span>
                    </div>
                    <div>
                      <strong>{scanAnalysis.detectionSummary.routeCount}</strong>
                      <span>Route candidates</span>
                    </div>
                  </div>
                  <p className="subtle-text">Active provider: {scanAnalysis.provider}</p>
                  <ol className="numbered-list subtle-text">
                    {scanAnalysis.captureGuidance.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                  {scanAnalysis.routeCandidates.length ? (
                    <div className="stack-sm">
                      <p>
                        <strong>Detected route candidates</strong>
                      </p>
                      <ol className="numbered-list subtle-text">
                        {scanAnalysis.routeCandidates.slice(0, 3).map((candidate) => (
                          <li key={candidate.id}>
                            {candidate.summary} Confidence {Math.round(candidate.confidence * 100)}%.
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="inline-actions wrap">
            <Button onClick={() => navigate(routes.selectDifficulty)} disabled={!isReadyForAutonomousGuidance}>
              Continue to route setup
            </Button>
            <Button variant="secondary" onClick={() => navigate(routes.scanWall)}>
              Retake scan
            </Button>
          </div>
        </Card>
      ) : null}
    </section>
  );
}
