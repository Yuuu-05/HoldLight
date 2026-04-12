import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../../../app/providers/CameraProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { updateClimbScanApi } from '../../../shared/api/climbing.api';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { triggerHaptic } from '../../../shared/lib/haptics';
import type { ClimbScan, Hold, HoldColor, WallManualReview, WallMap } from '../../../shared/types/climb';
import AssistMascotSticker from '../components/AssistMascotSticker';
import CameraPreview from '../components/CameraPreview';
import RouteCanvas from '../components/RouteCanvas';
import ScanPermissionNotice from '../components/ScanPermissionNotice';
import { useScanSession } from '../hooks/useScanSession';
import { getAvailableRouteCandidates } from '../services/routePlanner.service';
import { buildScanSafetyDecision } from '../services/safetyState.service';
import {
  formatHoldColor,
  localizeAssistText,
} from '../utils/localizedAssistText';

type ScanMobileStep = 'capture' | 'status' | 'review';

const HOLD_COLOR_OPTIONS: HoldColor[] = [
  'blue',
  'red',
  'green',
  'yellow',
  'pink',
  'purple',
  'orange',
  'black',
  'white',
  'unknown',
];

const HOLD_COLOR_REVIEW_GUIDANCE = 'Companion reviewed hold colors before route setup.';

function getWallMapColorsFromHolds(holds: Hold[]): HoldColor[] {
  return Array.from(
    new Set(holds.map((hold) => hold.color).filter((color) => color !== 'unknown')),
  ) as HoldColor[];
}

function getAverageHoldConfidence(holds: Hold[]) {
  if (holds.length === 0) return 0;
  return Number((holds.reduce((sum, hold) => sum + hold.confidence, 0) / holds.length).toFixed(2));
}

function countHoldColorChanges(originalWallMap: WallMap | undefined, nextWallMap: WallMap | null) {
  if (!originalWallMap || !nextWallMap) return 0;

  const originalColors = new Map(originalWallMap.holds.map((hold) => [hold.id, hold.color]));
  return nextWallMap.holds.reduce(
    (count, hold) => count + (originalColors.get(hold.id) !== hold.color ? 1 : 0),
    0,
  );
}

function refreshWallMapAfterColorReview(
  wallMap: WallMap,
  manualReview?: WallManualReview,
): WallMap {
  const colors = getWallMapColorsFromHolds(wallMap.holds);
  const baseWallMap: WallMap = {
    ...wallMap,
    colors,
  };
  const routeCandidates = getAvailableRouteCandidates(baseWallMap);
  const hasRouteCandidates = routeCandidates.length > 0;
  const canProceedAfterManualReview = Boolean(manualReview && hasRouteCandidates);
  const analysis = baseWallMap.analysis
    ? {
        ...baseWallMap.analysis,
        readiness:
          canProceedAfterManualReview
            ? 'ready' as const
            : !hasRouteCandidates
              ? 'retake_required' as const
            : baseWallMap.analysis.readiness,
        suggestedAction:
          canProceedAfterManualReview
            ? 'proceed' as const
            : !hasRouteCandidates
              ? 'retake' as const
            : baseWallMap.analysis.suggestedAction,
        shouldAllowAutonomousGuidance:
          hasRouteCandidates && (baseWallMap.analysis.shouldAllowAutonomousGuidance || canProceedAfterManualReview),
        captureGuidance: manualReview
          ? Array.from(new Set([HOLD_COLOR_REVIEW_GUIDANCE, ...baseWallMap.analysis.captureGuidance]))
          : baseWallMap.analysis.captureGuidance,
        routeCandidates,
        detectionSummary: {
          ...baseWallMap.analysis.detectionSummary,
          holdCount: baseWallMap.holds.length,
          routeCount: routeCandidates.length,
          averageHoldConfidence: getAverageHoldConfidence(baseWallMap.holds),
        },
        manualReview: manualReview ?? baseWallMap.analysis.manualReview,
      }
    : undefined;

  return {
    ...baseWallMap,
    analysis,
  };
}

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
  const { language, t } = useLanguage();
  const { scanProgress, latestScan, startScan } = useScanSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const uploadImageRef = useRef<HTMLImageElement>(null);
  const uploadVideoRef = useRef<HTMLVideoElement>(null);
  const [activeScan, setActiveScan] = useState<ClimbScan | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);
  const [overlayPreviewUrl, setOverlayPreviewUrl] = useState<string | null>(null);
  const [mobileStep, setMobileStep] = useState<ScanMobileStep>('capture');
  const [correctedWallMap, setCorrectedWallMap] = useState<WallMap | null>(null);
  const [selectedCorrectionHoldId, setSelectedCorrectionHoldId] = useState<string | null>(null);
  const [colorReviewSaving, setColorReviewSaving] = useState(false);
  const [colorReviewError, setColorReviewError] = useState<string | null>(null);
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

  async function handleScan(source: 'camera') {
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
      setMobileStep('review');
    } else {
      setMobileStep('status');
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
      setMobileStep('review');
    } else {
      setMobileStep('status');
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

  function handleCorrectionHoldSelect(hold: Hold) {
    setSelectedCorrectionHoldId(hold.id);
    setColorReviewError(null);
  }

  function handleCorrectionColorChange(color: HoldColor) {
    if (!displayScan || !selectedCorrectionHoldId) return;

    setCorrectedWallMap((currentWallMap) => {
      const baseWallMap = currentWallMap ?? displayScan.wallMap;
      const nextWallMap: WallMap = {
        ...baseWallMap,
        holds: baseWallMap.holds.map((hold) =>
          hold.id === selectedCorrectionHoldId ? { ...hold, color } : hold,
        ),
      };

      return refreshWallMapAfterColorReview(nextWallMap);
    });
    setColorReviewError(null);
  }

  function handleResetColorReview() {
    setCorrectedWallMap(null);
    setSelectedCorrectionHoldId(null);
    setColorReviewError(null);
  }

  async function handleSaveColorReview() {
    if (!displayScan) return;

    try {
      setColorReviewSaving(true);
      setColorReviewError(null);

      const manualReview: WallManualReview = {
        holdColorsReviewed: true,
        reviewedAt: new Date().toISOString(),
        colorCorrectionCount,
        reviewer: 'companion',
      };
      const reviewedWallMap = refreshWallMapAfterColorReview(
        correctedWallMap ?? displayScan.wallMap,
        manualReview,
      );
      if (!reviewedWallMap.analysis?.routeCandidates.length) {
        throw new Error('No same-colour route is available after color review.');
      }

      const updatedScan = await updateClimbScanApi(displayScan.id, {
        availableColors: reviewedWallMap.colors,
        wallMap: reviewedWallMap,
      });

      setActiveScan(updatedScan);
      setCorrectedWallMap(null);
      setSelectedCorrectionHoldId(null);
      triggerHaptic(24);
      navigate(routes.selectDifficulty);
    } catch (error) {
      setColorReviewError(error instanceof Error ? error.message : 'Unable to save hold color review.');
    } finally {
      setColorReviewSaving(false);
    }
  }

  const displayScan = activeScan ?? latestScan;
  const reviewScan = useMemo(
    () =>
      displayScan && correctedWallMap
        ? { ...displayScan, availableColors: correctedWallMap.colors, wallMap: correctedWallMap }
        : displayScan,
    [correctedWallMap, displayScan],
  );
  const selectedCorrectionHold = useMemo(
    () => reviewScan?.wallMap.holds.find((hold) => hold.id === selectedCorrectionHoldId) ?? null,
    [reviewScan?.wallMap.holds, selectedCorrectionHoldId],
  );
  const colorCorrectionCount = useMemo(
    () => countHoldColorChanges(displayScan?.wallMap, correctedWallMap),
    [correctedWallMap, displayScan?.wallMap],
  );
  const hasUnsavedColorReview = Boolean(correctedWallMap);
  const scanSafetyDecision = buildScanSafetyDecision(reviewScan);
  const shouldShowRetryNotice = Boolean(
    scanProgress.error
      || (reviewScan && scanSafetyDecision.status !== 'ready'),
  );
  const fallbackDescription = scanProgress.error
    ? t('The wall is a little tricky right now. Try again with a steadier phone or brighter light.')
    : localizeAssistText(scanSafetyDecision.detail, language);
  const localizedScanProgressMessage = localizeAssistText(scanProgress.message, language);
  const localizedScanError = localizeAssistText(scanProgress.error, language);
  const scanAnnouncement = scanProgress.status === 'error'
    ? `${t('Scan paused.')} ${localizedScanError || t('We could not finish this scan.')}`
    : localizedScanProgressMessage;
  useEffect(() => {
    setCorrectedWallMap(null);
    setSelectedCorrectionHoldId(null);
    setColorReviewError(null);
  }, [displayScan?.id]);

  useEffect(() => {
    if (reviewScan && !scanBusy) {
      setMobileStep('review');
    }
  }, [reviewScan?.id, scanBusy]);

  useEffect(() => {
    if (!reviewScan || selectedCorrectionHoldId) return;
    setSelectedCorrectionHoldId(reviewScan.wallMap.holds[0]?.id ?? null);
  }, [reviewScan, selectedCorrectionHoldId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 720px)').matches) return;

    document.getElementById('main-content')?.scrollIntoView({ block: 'start' });
  }, [mobileStep]);

  return (
    <section className={`stack-lg assist-shell ${reviewScan ? 'assist-shell-review-mode' : ''}`.trim()}>
      {!reviewScan ? (
        <>
          <nav className="assist-mobile-flow-tabs" aria-label={t('Assist flow steps')}>
            {[
              { id: 'capture' as const, label: t('Scan') },
              { id: 'status' as const, label: t('Status') },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`assist-mobile-flow-tab ${mobileStep === item.id ? 'is-active' : ''}`.trim()}
                aria-current={mobileStep === item.id ? 'step' : undefined}
                onClick={() => setMobileStep(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <Card
            title={t('Assist')}
            className="tone-blue assist-hero-card assist-scan-hero-card assist-mobile-panel"
            bodyClassName="stack-md"
            data-mobile-active={mobileStep === 'capture' ? 'true' : 'false'}
          >
            <div className="assist-scan-intro">
              <p className="assist-scan-note">
                {t('Frame the whole wall like a sticker photo and keep the phone steady for a cleaner route match.')}
              </p>
            </div>
            <ScanPermissionNotice supported={supported} hasSecureContext={hasSecureContext} />
            <CameraPreview
              stream={stream}
              videoRef={videoRef}
              className="assist-camera-stage"
              label={t('Camera preview for wall recognition')}
            >
              {scanBusy ? (
                <div className="assist-camera-loader" role="status" aria-hidden="true">
                  <div className="assist-camera-loader-card">
                    <AssistMascotSticker variant="observe" className="assist-camera-loader-mascot" />
                <div className="stack-sm">
                  <strong>{t('Checking wall map')}</strong>
                  <p>{t('Hold the phone steady while route recognition finishes its pass.')}</p>
                  <div
                    className="assist-inline-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={scanProgress.progress}
                    aria-valuetext={localizedScanProgressMessage}
                  >
                    <span style={{ width: `${scanProgress.progress}%` }} />
                  </div>
                  <small>{scanProgress.progress}%</small>
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
                {t('Scan with camera')}
              </Button>
            </div>
            <div className="assist-mobile-step-actions">
              <Button variant="secondary" onClick={() => setMobileStep('status')}>
                {t('View progress')}
              </Button>
            </div>
          </Card>

          <Card
            title={t('Upload a wall photo or video')}
            className="tone-yellow assist-bottom-sheet assist-upload-sheet assist-mobile-panel"
            bodyClassName="stack-md"
            data-mobile-active={mobileStep === 'capture' ? 'true' : 'false'}
          >
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={handleUploadSelected}
            />
            <div className="inline-actions wrap">
              <Button variant="secondary" onClick={() => mediaInputRef.current?.click()} disabled={scanBusy}>
                {t('Upload')}
              </Button>
              <Button onClick={() => void handleUploadScan()} disabled={!uploadType || scanBusy}>
                {t('Scan uploaded media')}
              </Button>
            </div>
            {uploadType && uploadPreviewUrl ? (
              <div className="stack-sm">
                <p className="subtle-text">{t('Selected file:')} {uploadName}</p>
                <div className="assist-upload-preview-frame">
                  {uploadType === 'image' ? (
                    <img ref={uploadImageRef} className="camera-preview" src={uploadPreviewUrl} alt={t('Uploaded wall preview')} />
                  ) : (
                    <video ref={uploadVideoRef} className="camera-preview" src={uploadPreviewUrl} controls playsInline muted />
                  )}
                  {scanBusy ? (
                    <div className="assist-upload-progress-bar" aria-hidden="true">
                      <span style={{ width: `${scanProgress.progress}%` }} />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="camera-placeholder camera-placeholder-assist">
                {t('Upload a wall photo or video')}
              </div>
            )}
          </Card>

          <Card
            title={t('Scan pulse')}
            className="assist-bottom-sheet assist-status-sheet assist-mobile-panel"
            bodyClassName="stack-md"
            data-mobile-active={mobileStep === 'status' ? 'true' : 'false'}
          >
            <div className="assist-status-head">
              <p className="assist-status-copy">
                <strong>{localizedScanProgressMessage}</strong>
              </p>
              <span className="assist-status-progress">{scanProgress.progress}%</span>
            </div>
            <div
              className="assist-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={scanProgress.progress}
              aria-valuetext={localizedScanProgressMessage}
            >
              <span className="assist-progress-bar" style={{ width: `${scanProgress.progress}%` }} />
            </div>
            {shouldShowRetryNotice ? (
              <div className="assist-soft-warning-card" role="note" aria-live="polite">
                <AssistMascotSticker variant="flashlight" className="assist-warning-mascot" />
                <div className="stack-sm">
                  <strong>{t('That wall is a little dim right now')}</strong>
                  <p>{fallbackDescription}</p>
                  <div className="inline-actions wrap">
                    <Button onClick={() => navigate(routes.scanWall)}>{t('Retake scan')}</Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="assist-mobile-step-actions">
              <Button variant="secondary" onClick={() => setMobileStep('capture')}>{t('Back to scan')}</Button>
            </div>
          </Card>
        </>
      ) : (
        <Card
          className="assist-scan-review-card assist-stable-card"
          bodyClassName="assist-color-review-layout"
        >
          <div className="assist-color-review-canvas">
            <RouteCanvas
              wallMap={reviewScan.wallMap}
              backgroundImageUrl={overlayPreviewUrl ?? reviewScan.coverImageUrl}
              plainImagePreview
              fitContainer
              selectedHoldId={selectedCorrectionHoldId ?? undefined}
              selectedHoldColor={selectedCorrectionHold?.color}
              onHoldSelect={handleCorrectionHoldSelect}
              helperText={t('Tap a hold circle, then choose its correct color.')}
            />
          </div>
          <div className="assist-color-review-panel">
            <div className="assist-color-review-head">
              <div className="stack-sm">
                <strong>{t('Tap a circle, choose the right color')}</strong>
                <p className="subtle-text">
                  {t('Confirming saves the corrected wall and opens route setup.')}
                </p>
              </div>
            </div>

            <div className="assist-color-picker-shell">
              {selectedCorrectionHold ? (
                <>
                  <div className="assist-color-swatch-grid" role="group" aria-label={t('Choose corrected hold color')}>
                    {HOLD_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`assist-color-swatch assist-color-swatch-${color} ${selectedCorrectionHold.color === color ? 'is-active' : ''}`.trim()}
                        aria-pressed={selectedCorrectionHold.color === color}
                        onClick={() => handleCorrectionColorChange(color)}
                      >
                        {formatHoldColor(color, language, true)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="subtle-text">{t('Tap any detected hold circle to edit its color.')}</p>
              )}
            </div>

            <div className="assist-color-action-row">
              <Button
                type="button"
                variant="secondary"
                onClick={handleResetColorReview}
                disabled={!hasUnsavedColorReview || colorReviewSaving}
              >
                {t('Reset color changes')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate(routes.scanWall)} disabled={colorReviewSaving}>
                {t('Retake scan')}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveColorReview()}
                disabled={colorReviewSaving}
              >
                {colorReviewSaving
                  ? t('Saving...')
                  : t('Confirm and set route')}
              </Button>
            </div>

            {colorReviewError ? (
              <p className="subtle-text" role="alert">
                {localizeAssistText(colorReviewError, language)}
              </p>
            ) : null}
          </div>
        </Card>
      )}
    </section>
  );
}
