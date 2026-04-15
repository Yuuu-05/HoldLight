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

type ScanMobileStep = 'capture' | 'review';
type ReviewToolMode = 'select' | 'add' | 'delete';

interface CanvasPosition {
  xPct: number;
  yPct: number;
}

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

const HOLD_MANUAL_REVIEW_GUIDANCE = 'Companion reviewed hold detections before route setup.';

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
    (count, hold) => {
      const originalColor = originalColors.get(hold.id);
      return count + (originalColor && originalColor !== hold.color ? 1 : 0);
    },
    0,
  );
}

function countAddedHolds(originalWallMap: WallMap | undefined, nextWallMap: WallMap | null) {
  if (!originalWallMap || !nextWallMap) return 0;

  const originalIds = new Set(originalWallMap.holds.map((hold) => hold.id));
  return nextWallMap.holds.reduce(
    (count, hold) => count + (originalIds.has(hold.id) ? 0 : 1),
    0,
  );
}

function countDeletedHolds(originalWallMap: WallMap | undefined, nextWallMap: WallMap | null) {
  if (!originalWallMap || !nextWallMap) return 0;

  const nextIds = new Set(nextWallMap.holds.map((hold) => hold.id));
  return originalWallMap.holds.reduce(
    (count, hold) => count + (nextIds.has(hold.id) ? 0 : 1),
    0,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getHoldRadiusPct(hold: Hold) {
  if (typeof hold.radiusPct === 'number' && Number.isFinite(hold.radiusPct) && hold.radiusPct > 0) {
    return hold.radiusPct;
  }

  const hasBox =
    hold.x1Pct !== undefined &&
    hold.y1Pct !== undefined &&
    hold.x2Pct !== undefined &&
    hold.y2Pct !== undefined;

  if (hasBox) {
    return Math.max((hold.x2Pct! - hold.x1Pct!) / 2, (hold.y2Pct! - hold.y1Pct!) / 2);
  }

  return 2.8;
}

function getSuggestedManualHoldRadiusPct(holds: Hold[]) {
  const radii = holds
    .map(getHoldRadiusPct)
    .filter((radius): radius is number => Number.isFinite(radius) && radius > 0)
    .sort((left, right) => left - right);

  if (radii.length === 0) {
    return 2.8;
  }

  const middleIndex = Math.floor(radii.length / 2);
  const medianRadius = radii.length % 2 === 0
    ? (radii[middleIndex - 1] + radii[middleIndex]) / 2
    : radii[middleIndex];

  return Number(clamp(medianRadius, 1.8, 5.6).toFixed(2));
}

function getNextManualHoldLabel(holds: Hold[]) {
  const highestNumber = holds.reduce((currentHighest, hold) => {
    const matches = hold.label.match(/\d+/g);
    const lastMatch = matches?.[matches.length - 1];
    const parsedNumber = lastMatch ? Number.parseInt(lastMatch, 10) : Number.NaN;
    return Number.isFinite(parsedNumber) ? Math.max(currentHighest, parsedNumber) : currentHighest;
  }, 0);

  return `Hold ${highestNumber + 1}`;
}

function inferManualHoldSize(radiusPct: number): Hold['size'] {
  if (radiusPct >= 4.1) return 'l';
  if (radiusPct <= 2.3) return 's';
  return 'm';
}

function findNearbyHold(holds: Hold[], position: CanvasPosition): Hold | null {
  let closestHold: Hold | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  holds.forEach((hold) => {
    const dx = hold.xPct - position.xPct;
    const dy = hold.yPct - position.yPct;
    const distance = Math.hypot(dx, dy);
    const threshold = Math.max(getHoldRadiusPct(hold) * 1.35, 2.6);

    if (distance <= threshold && distance < closestDistance) {
      closestHold = hold;
      closestDistance = distance;
    }
  });

  return closestHold;
}

function createManualHold(baseWallMap: WallMap, position: CanvasPosition, color: HoldColor): Hold {
  const radiusPct = getSuggestedManualHoldRadiusPct(baseWallMap.holds);

  return {
    id: `manual_hold_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: getNextManualHoldLabel(baseWallMap.holds),
    color,
    xPct: position.xPct,
    yPct: position.yPct,
    confidence: 0.99,
    role: 'intermediate',
    size: inferManualHoldSize(radiusPct),
    radiusPct,
  };
}

function refreshWallMapAfterManualReview(
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
          ? Array.from(new Set([HOLD_MANUAL_REVIEW_GUIDANCE, ...baseWallMap.analysis.captureGuidance]))
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
  const { scanProgress, latestScan, startScan, resetScanSession } = useScanSession();
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
  const [reviewMode, setReviewMode] = useState<ReviewToolMode>('select');
  const [pendingAddColor, setPendingAddColor] = useState<HoldColor>('blue');
  const [selectedCorrectionHoldId, setSelectedCorrectionHoldId] = useState<string | null>(null);
  const [colorReviewSaving, setColorReviewSaving] = useState(false);
  const [colorReviewError, setColorReviewError] = useState<string | null>(null);
  const hasSecureContext = typeof window === 'undefined' ? true : window.isSecureContext;
  const scanBusy = scanProgress.status === 'scanning' || scanProgress.status === 'saving';
  const previousScanStatusRef = useRef(scanProgress.status);
  const displayScan = activeScan ?? latestScan;

  usePageTitle('Assist');

  useEffect(() => {
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
      setMobileStep('capture');
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
      setMobileStep('capture');
    }
  }

  async function handleRetakeScan() {
    setActiveScan(null);
    setCorrectedWallMap(null);
    setReviewMode('select');
    setSelectedCorrectionHoldId(null);
    setColorReviewError(null);
    setMobileStep('capture');
    resetScanSession();

    if (supported && hasSecureContext && !stream) {
      await requestAccess();
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
    const baseWallMap = correctedWallMap ?? displayScan?.wallMap ?? null;
    if (!baseWallMap || !selectedCorrectionHoldId) return;

    const targetHold = baseWallMap.holds.find((hold) => hold.id === selectedCorrectionHoldId);
    if (!targetHold || targetHold.color === color) return;

    const nextWallMap: WallMap = {
      ...baseWallMap,
      holds: baseWallMap.holds.map((hold) =>
        hold.id === selectedCorrectionHoldId ? { ...hold, color } : hold,
      ),
    };

    setCorrectedWallMap(refreshWallMapAfterManualReview(nextWallMap));
    setColorReviewError(null);
  }

  function handleAddHoldAtPosition(position: CanvasPosition) {
    const baseWallMap = correctedWallMap ?? displayScan?.wallMap ?? null;
    if (!baseWallMap) return;

    const nearbyHold = findNearbyHold(baseWallMap.holds, position);
    if (nearbyHold) {
      setSelectedCorrectionHoldId(nearbyHold.id);
      setReviewMode('select');
      setColorReviewError(null);
      return;
    }

    const nextHold = createManualHold(baseWallMap, position, pendingAddColor);
    const nextWallMap: WallMap = {
      ...baseWallMap,
      holds: [...baseWallMap.holds, nextHold],
    };

    setCorrectedWallMap(refreshWallMapAfterManualReview(nextWallMap));
    setSelectedCorrectionHoldId(nextHold.id);
    setColorReviewError(null);
  }

  function handleDeleteSelectedHold() {
    const baseWallMap = correctedWallMap ?? displayScan?.wallMap ?? null;
    if (!baseWallMap || !selectedCorrectionHoldId) return;

    if (baseWallMap.holds.length <= 1) {
      setColorReviewError('At least one hold must remain on the wall.');
      return;
    }

    const nextHolds = baseWallMap.holds.filter((hold) => hold.id !== selectedCorrectionHoldId);
    if (nextHolds.length === baseWallMap.holds.length) return;

    const nextWallMap: WallMap = {
      ...baseWallMap,
      holds: nextHolds,
    };

    setCorrectedWallMap(refreshWallMapAfterManualReview(nextWallMap));
    setSelectedCorrectionHoldId(nextHolds[0]?.id ?? null);
    setColorReviewError(null);
  }

  function handleReviewModeChange(mode: ReviewToolMode) {
    setReviewMode(mode);
    setColorReviewError(null);

    if (mode !== 'add' && !selectedCorrectionHoldId) {
      const nextHoldId = (correctedWallMap ?? displayScan?.wallMap ?? null)?.holds[0]?.id ?? null;
      setSelectedCorrectionHoldId(nextHoldId);
    }
  }

  function handleReviewColorPick(color: HoldColor) {
    if (reviewMode === 'add') {
      setPendingAddColor(color);
      setColorReviewError(null);
      return;
    }

    handleCorrectionColorChange(color);
  }

  function handleResetColorReview() {
    setCorrectedWallMap(null);
    setReviewMode('select');
    setSelectedCorrectionHoldId(displayScan?.wallMap.holds[0]?.id ?? null);
    setColorReviewError(null);
  }

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
  const addedHoldCount = useMemo(
    () => countAddedHolds(displayScan?.wallMap, correctedWallMap),
    [correctedWallMap, displayScan?.wallMap],
  );
  const deletedHoldCount = useMemo(
    () => countDeletedHolds(displayScan?.wallMap, correctedWallMap),
    [correctedWallMap, displayScan?.wallMap],
  );
  const totalCorrectionCount = colorCorrectionCount + addedHoldCount + deletedHoldCount;
  const hasPendingManualCorrections = totalCorrectionCount > 0;

  async function handleSaveColorReview() {
    if (!displayScan) return;

    try {
      setColorReviewSaving(true);
      setColorReviewError(null);

      const manualReview: WallManualReview = {
        holdColorsReviewed: true,
        reviewedAt: new Date().toISOString(),
        colorCorrectionCount,
        holdAdditionCount: addedHoldCount,
        holdDeletionCount: deletedHoldCount,
        totalCorrectionCount,
        reviewer: 'companion',
      };
      const reviewedWallMap = refreshWallMapAfterManualReview(
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
      setReviewMode('select');
      setSelectedCorrectionHoldId(null);
      triggerHaptic(24);
      navigate(routes.selectDifficulty);
    } catch (error) {
      setColorReviewError(error instanceof Error ? error.message : 'Unable to save hold color review.');
    } finally {
      setColorReviewSaving(false);
    }
  }
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
  const activeReviewColor = reviewMode === 'add'
    ? pendingAddColor
    : selectedCorrectionHold?.color ?? null;
  const reviewCanvasHelperText = reviewMode === 'add'
    ? t('Tap the wall photo to place a missing hold.')
    : reviewMode === 'delete'
      ? t('Tap a detected hold, then remove it if needed.')
      : t('Tap a hold to inspect it or adjust its color.');
  const reviewModeTitle = reviewMode === 'add'
    ? t('Add missing holds')
    : reviewMode === 'delete'
      ? t('Delete false holds')
      : t('Edit hold colors');
  const reviewModeDescription = reviewMode === 'add'
    ? t('Choose a color, then tap the wall photo to place a missing hold.')
    : reviewMode === 'delete'
      ? t('Pick a detected hold, then remove it if the scan marked a false hold.')
      : t('Select a hold, then adjust its color if needed.');

  useEffect(() => {
    setCorrectedWallMap(null);
    setReviewMode('select');
    setPendingAddColor(displayScan?.availableColors[0] ?? displayScan?.wallMap.colors[0] ?? 'blue');
    setSelectedCorrectionHoldId(displayScan?.wallMap.holds[0]?.id ?? null);
    setColorReviewError(null);
  }, [displayScan?.id]);

  useEffect(() => {
    if (reviewScan && !scanBusy) {
      setMobileStep('review');
    }
  }, [reviewScan?.id, scanBusy]);

  useEffect(() => {
    if (!reviewScan || reviewMode === 'add') return;

    const hasSelectedHold = reviewScan.wallMap.holds.some((hold) => hold.id === selectedCorrectionHoldId);
    if (hasSelectedHold) return;

    setSelectedCorrectionHoldId(reviewScan.wallMap.holds[0]?.id ?? null);
  }, [reviewMode, reviewScan, selectedCorrectionHoldId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 720px)').matches) return;

    document.getElementById('main-content')?.scrollIntoView({ block: 'start' });
  }, [mobileStep]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!reviewScan) return undefined;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [reviewScan]);

  return (
    <section className={`stack-lg assist-shell ${reviewScan ? 'assist-shell-review-mode' : ''}`.trim()}>
      {!reviewScan ? (
        <>
          <Card
            title={t('Assist')}
            actions={<span className="assist-card-inline-hint">{t('Full wall in frame')}</span>}
            className="tone-blue assist-hero-card assist-scan-hero-card assist-mobile-panel"
            bodyClassName="stack-md"
            data-mobile-active={mobileStep === 'capture' ? 'true' : 'false'}
          >
            <ScanPermissionNotice supported={supported} hasSecureContext={hasSecureContext} />
            <CameraPreview
              stream={stream}
              videoRef={videoRef}
              className="assist-camera-stage assist-camera-stage-natural"
              label={t('Camera preview for wall recognition')}
              syncAspectRatio
              fallbackAspectRatio="3 / 4"
              showMask={false}
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
              <Button
                className="assist-scan-confirm-button"
                onClick={() => void handleScan('camera')}
                disabled={!supported || !hasSecureContext || scanBusy}
              >
                {t('Scan with camera')}
              </Button>
            </div>
            {shouldShowRetryNotice ? (
              <div className="assist-soft-warning-card assist-inline-scan-warning" role="note" aria-live="polite">
                <AssistMascotSticker variant="flashlight" className="assist-warning-mascot" />
                <div className="stack-sm">
                  <strong>{t('That wall is a little dim right now')}</strong>
                  <p>{fallbackDescription}</p>
                  <div className="inline-actions wrap">
                    <Button onClick={() => void handleRetakeScan()}>{t('Retake scan')}</Button>
                  </div>
                </div>
              </div>
            ) : null}
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

        </>
      ) : (
        <Card
          className="assist-scan-review-card assist-stable-card"
          bodyClassName="assist-color-review-layout"
        >
          <div className={`assist-color-review-canvas is-${reviewMode}-mode`.trim()}>
            <div className="assist-review-phone-stage">
              <RouteCanvas
                wallMap={reviewScan.wallMap}
                backgroundImageUrl={overlayPreviewUrl ?? reviewScan.coverImageUrl}
                plainImagePreview
                fitContainer
                holdOverlayStyle="subtle"
                selectedHoldId={selectedCorrectionHoldId ?? undefined}
                selectedHoldColor={reviewMode === 'delete' ? 'red' : activeReviewColor ?? undefined}
                onHoldSelect={reviewMode === 'add' ? undefined : handleCorrectionHoldSelect}
                onCanvasSelect={reviewMode === 'add' ? handleAddHoldAtPosition : undefined}
                helperText={reviewCanvasHelperText}
              />
            </div>
          </div>
          <div className="assist-color-review-panel">
            <div className="assist-color-review-head">
              <div className="assist-review-title-row">
                <span className="assist-review-kicker">{t('Hold correction')}</span>
                <strong>{t('Correct missing or mistaken holds')}</strong>
              </div>
            </div>

            <div className="assist-review-tool-shell">
              <div className="assist-review-tool-toggle" role="group" aria-label={t('Correction tools')}>
                {[
                  { id: 'select' as const, label: t('Edit colors') },
                  { id: 'add' as const, label: t('Add hold') },
                  { id: 'delete' as const, label: t('Delete hold') },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`assist-review-tool-button ${reviewMode === item.id ? 'is-active' : ''}`.trim()}
                    aria-pressed={reviewMode === item.id}
                    onClick={() => handleReviewModeChange(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="assist-review-tool-copy">
                <strong>{reviewModeTitle}</strong>
                <p className="subtle-text">{reviewModeDescription}</p>
              </div>
            </div>

            <div className="assist-color-picker-shell">
              {reviewMode === 'delete' ? (
                selectedCorrectionHold ? (
                  <div className="assist-review-selection-card">
                    <div className="assist-review-selection-row">
                      <strong>{selectedCorrectionHold.label}</strong>
                      <span className={`assist-review-color-pill is-${selectedCorrectionHold.color}`.trim()}>
                        {formatHoldColor(selectedCorrectionHold.color, language, true)}
                      </span>
                    </div>
                    <p className="subtle-text">
                      {t('Delete this hold if it was detected by mistake.')}
                    </p>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleDeleteSelectedHold}
                      disabled={colorReviewSaving}
                    >
                      {t('Delete selected hold')}
                    </Button>
                  </div>
                ) : (
                  <p className="subtle-text">{t('Tap a detected hold to choose which one to remove.')}</p>
                )
              ) : (
                <>
                  <div className="assist-color-selection-summary">
                    <strong>{reviewMode === 'add' ? t('Color for new holds') : t('Selected hold color')}</strong>
                  </div>
                  <div className="assist-color-swatch-grid" role="group" aria-label={t('Choose corrected hold color')}>
                    {HOLD_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`assist-color-swatch assist-color-swatch-${color} ${activeReviewColor === color ? 'is-active' : ''}`.trim()}
                        aria-pressed={activeReviewColor === color}
                        onClick={() => handleReviewColorPick(color)}
                      >
                        {formatHoldColor(color, language, true)}
                      </button>
                    ))}
                  </div>
                  {reviewMode === 'select' && !selectedCorrectionHold ? (
                    <p className="subtle-text">{t('Tap any detected hold circle to edit its color.')}</p>
                  ) : null}
                </>
              )}
            </div>

            <div className="assist-color-action-row">
              <Button
                type="button"
                className="assist-review-confirm-button"
                onClick={() => void handleSaveColorReview()}
                disabled={colorReviewSaving}
              >
                {colorReviewSaving
                  ? t('Saving...')
                  : t('Confirm and set route')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleResetColorReview}
                disabled={!hasPendingManualCorrections || colorReviewSaving}
              >
                {t('Reset edits')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleRetakeScan()} disabled={colorReviewSaving}>
                {t('Retake scan')}
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
