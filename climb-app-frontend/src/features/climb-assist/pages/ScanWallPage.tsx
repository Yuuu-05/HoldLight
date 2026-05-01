import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useCamera } from '../../../app/providers/CameraProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { PhotoIcon, ScanIcon } from '../../../shared/components/icons/AppIcons';
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
import { useScanSession } from '../hooks/useScanSession';
import { getAvailableRouteCandidates } from '../services/routePlanner.service';
import { buildScanSafetyDecision } from '../services/safetyState.service';
import {
  formatHoldColor,
  localizeAssistText,
} from '../utils/localizedAssistText';

type ScanMobileStep = 'capture' | 'review';
type ScanMode = 'upload' | 'live';
type ReviewToolMode = 'select' | 'add' | 'delete';

interface CanvasPosition {
  xPct: number;
  yPct: number;
}

interface ReviewHistorySnapshot {
  wallMap: WallMap | null;
  selectedHoldIds: string[];
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
  const { simplifiedMode } = useAccessibility();
  const {
    activeFacingMode,
    cameraError,
    cameraErrorReason,
    cameraNotice,
    supported,
    stream,
    requestAccess,
    stopStream,
    switchCamera,
  } = useCamera();
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
  const [scanMode, setScanMode] = useState<ScanMode>('live');
  const [overlayPreviewUrl, setOverlayPreviewUrl] = useState<string | null>(null);
  const [mobileStep, setMobileStep] = useState<ScanMobileStep>('capture');
  const [correctedWallMap, setCorrectedWallMap] = useState<WallMap | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewToolMode>('select');
  const [pendingAddColor, setPendingAddColor] = useState<HoldColor>('blue');
  const [pendingEditColor, setPendingEditColor] = useState<HoldColor | null>(null);
  const [selectedCorrectionHoldIds, setSelectedCorrectionHoldIds] = useState<string[]>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistorySnapshot[]>([]);
  const [colorReviewSaving, setColorReviewSaving] = useState(false);
  const [colorReviewError, setColorReviewError] = useState<string | null>(null);
  const hasSecureContext = typeof window === 'undefined' ? true : window.isSecureContext;
  const scanBusy = scanProgress.status === 'scanning' || scanProgress.status === 'saving';
  const [cameraRequesting, setCameraRequesting] = useState(false);
  const [cameraRequestFailed, setCameraRequestFailed] = useState(false);
  const [scanRetryPrompt, setScanRetryPrompt] = useState<string | null>(null);
  const shouldRestoreCameraOnVisibleRef = useRef(false);
  const autoRequestedCameraRef = useRef(false);
  const canOpenCameraPermission = supported && hasSecureContext;
  const cameraStatusTone = !supported || !hasSecureContext || (cameraErrorReason && !stream)
    ? 'blocked'
    : stream
      ? 'ready'
      : 'idle';
  const cameraReadyLabel = activeFacingMode === 'environment'
    ? t('Rear camera active')
    : activeFacingMode === 'user'
      ? t('Front camera active')
      : t('Camera ready');
  const cameraStatusLabel = !supported
    ? t('Camera unavailable')
    : !hasSecureContext
      ? t('HTTPS needed')
      : stream
        ? cameraReadyLabel
        : t('Permission needed');
  const localizedCameraMessage = localizeAssistText(cameraError ?? cameraNotice, language);
  const cameraPermissionDescription = !supported
    ? t('Camera access is not available in this browser. Use a supported mobile browser or upload a wall photo or video instead.')
    : !hasSecureContext
      ? t('Camera access in mobile browsers needs HTTPS or localhost. Publish the site over HTTPS or upload a wall photo or video instead.')
      : localizedCameraMessage || t('Your browser will ask for camera permission before the live preview starts.');
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

  useEffect(() => () => {
    stopStream();
  }, [stopStream]);

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
        videoElement.removeEventListener('loadeddata', handleReady);
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

      const timeoutId = window.setTimeout(() => finish(hasFrame()), 1800);

      videoElement.addEventListener('loadedmetadata', handleReady);
      videoElement.addEventListener('loadeddata', handleReady);
      videoElement.addEventListener('canplay', handleReady);
      videoElement.addEventListener('playing', handleReady);
      if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
        handleReady();
        return;
      }
      void videoElement.play().catch(() => undefined);
    });
  }

  async function handleRequestCameraAccess(forceNew = false) {
    if (!canOpenCameraPermission || scanBusy || cameraRequesting) return;

    try {
      setScanMode('live');
      setCameraRequesting(true);
      setCameraRequestFailed(false);
      setScanRetryPrompt(null);
      const nextStream = await requestAccess({
        preferredFacingMode: 'environment',
        forceNew,
        allowFallback: true,
      });

      if (!nextStream) {
        setCameraRequestFailed(true);
        setScanRetryPrompt('Camera permission did not open. Check browser permission and try again.');
        return;
      }

      await ensureCameraPreviewReady(nextStream);
    } finally {
      setCameraRequesting(false);
    }
  }

  async function handleSwitchCamera() {
    if (!canOpenCameraPermission || scanBusy || cameraRequesting) return;

    try {
      setScanMode('live');
      setCameraRequesting(true);
      setCameraRequestFailed(false);
      setScanRetryPrompt(null);
      const nextStream = await switchCamera();

      if (!nextStream) {
        setCameraRequestFailed(true);
        setScanRetryPrompt('Camera permission did not open. Check browser permission and try again.');
        return;
      }

      await ensureCameraPreviewReady(nextStream);
    } finally {
      setCameraRequesting(false);
    }
  }

  function handleScanModeSelect(nextMode: ScanMode) {
    setScanMode(nextMode);
    setCameraRequestFailed(false);
    setScanRetryPrompt(null);

    if (nextMode === 'upload') {
      stopStream();
      mediaInputRef.current?.click();
      return;
    }

    if (!stream && canOpenCameraPermission && !scanBusy && !cameraRequesting) {
      void handleRequestCameraAccess();
    }
  }

  async function handleScan(source: 'camera') {
    if (scanBusy) return;

    setScanMode('live');
    setScanRetryPrompt(null);
    let activeStream = stream;

    if (source === 'camera' && supported && hasSecureContext && !stream) {
      setCameraRequestFailed(false);
      activeStream = await requestAccess({
        preferredFacingMode: 'environment',
        allowFallback: true,
      });
      if (!activeStream) {
        setCameraRequestFailed(true);
        setScanRetryPrompt('Camera permission did not open. Check browser permission and try again.');
        return;
      }
    }

    if (source === 'camera') {
      const previewReady = await ensureCameraPreviewReady(activeStream);
      if (!previewReady) {
        setScanRetryPrompt('The live camera preview is not ready yet.');
        return;
      }
    }

    const scan = await startScan({
      source,
      gymName: 'Campus climbing gym',
      videoElement: videoRef.current,
    });

    if (scan) {
      stopStream();
      setScanRetryPrompt(null);
      setActiveScan(scan);
      setMobileStep('review');
    } else {
      setMobileStep('capture');
    }
  }

  async function handleUploadScan() {
    if (!uploadType || scanBusy) return;

    setScanMode('upload');
    setScanRetryPrompt(null);
    const scan = await startScan({
      gymName: 'Campus climbing gym',
      imageElement: uploadImageRef.current,
      uploadedVideoElement: uploadVideoRef.current,
      uploadType,
    });

    if (scan) {
      setScanRetryPrompt(null);
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
    setPendingEditColor(null);
    setSelectedCorrectionHoldIds([]);
    setReviewHistory([]);
    setColorReviewError(null);
    setScanRetryPrompt(null);
    setMobileStep('capture');
    setScanMode('live');
    resetScanSession();

    if (supported && hasSecureContext) {
      await handleRequestCameraAccess(true);
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

    setScanMode('upload');
    setScanRetryPrompt(null);
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(nextUrl);
    setUploadName(file.name);
    setUploadType(nextType);
  }

  function handleCorrectionHoldSelect(hold: Hold) {
    setSelectedCorrectionHoldIds((currentIds) =>
      currentIds.includes(hold.id)
        ? currentIds.filter((holdId) => holdId !== hold.id)
        : [...currentIds, hold.id],
    );
    setColorReviewError(null);
  }

  function pushReviewHistorySnapshot(baseWallMap: WallMap | null, holdIds: string[]) {
    setReviewHistory((history) => [
      ...history,
      {
        wallMap: baseWallMap,
        selectedHoldIds: holdIds,
      },
    ]);
  }

  function handleCorrectionColorChange(color: HoldColor) {
    const baseWallMap = correctedWallMap ?? displayScan?.wallMap ?? null;
    if (!baseWallMap) return;

    const selectedIds = new Set(selectedCorrectionHoldIds);
    if (selectedIds.size === 0) {
      setColorReviewError('Select a hold first');
      return;
    }

    const hasAnyTargetHold = baseWallMap.holds.some((hold) => selectedIds.has(hold.id));
    const hasAnyColorChange = baseWallMap.holds.some((hold) => selectedIds.has(hold.id) && hold.color !== color);
    if (!hasAnyTargetHold) return;
    if (!hasAnyColorChange) {
      setSelectedCorrectionHoldIds([]);
      setPendingEditColor(null);
      setColorReviewError(null);
      return;
    }

    const nextWallMap: WallMap = {
      ...baseWallMap,
      holds: baseWallMap.holds.map((hold) =>
        selectedIds.has(hold.id) ? { ...hold, color } : hold,
      ),
    };

    pushReviewHistorySnapshot(correctedWallMap, selectedCorrectionHoldIds);
    setCorrectedWallMap(refreshWallMapAfterManualReview(nextWallMap));
    setSelectedCorrectionHoldIds([]);
    setPendingEditColor(null);
    setColorReviewError(null);
  }

  function handleAddHoldAtPosition(position: CanvasPosition) {
    const baseWallMap = correctedWallMap ?? displayScan?.wallMap ?? null;
    if (!baseWallMap) return;

    const nearbyHold = findNearbyHold(baseWallMap.holds, position);
    if (nearbyHold) {
      setSelectedCorrectionHoldIds([nearbyHold.id]);
      setPendingEditColor(null);
      setReviewMode('select');
      setColorReviewError(null);
      return;
    }

    const nextHold = createManualHold(baseWallMap, position, pendingAddColor);
    const nextWallMap: WallMap = {
      ...baseWallMap,
      holds: [...baseWallMap.holds, nextHold],
    };

    pushReviewHistorySnapshot(correctedWallMap, selectedCorrectionHoldIds);
    setCorrectedWallMap(refreshWallMapAfterManualReview(nextWallMap));
    setSelectedCorrectionHoldIds([nextHold.id]);
    setPendingEditColor(null);
    setColorReviewError(null);
  }

  function handleDeleteSelectedHold() {
    const baseWallMap = correctedWallMap ?? displayScan?.wallMap ?? null;
    if (!baseWallMap || selectedCorrectionHoldIds.length === 0) return;

    const selectedIds = new Set(selectedCorrectionHoldIds);
    const deletableIds = new Set(baseWallMap.holds.filter((hold) => selectedIds.has(hold.id)).map((hold) => hold.id));

    if (deletableIds.size === 0) return;

    if (baseWallMap.holds.length - deletableIds.size < 1) {
      setColorReviewError('At least one hold must remain on the wall.');
      return;
    }

    const nextHolds = baseWallMap.holds.filter((hold) => !deletableIds.has(hold.id));
    if (nextHolds.length === baseWallMap.holds.length) return;

    const nextWallMap: WallMap = {
      ...baseWallMap,
      holds: nextHolds,
    };

    pushReviewHistorySnapshot(correctedWallMap, selectedCorrectionHoldIds);
    setCorrectedWallMap(refreshWallMapAfterManualReview(nextWallMap));
    setSelectedCorrectionHoldIds([]);
    setPendingEditColor(null);
    setColorReviewError(null);
  }

  function handleReviewModeChange(mode: ReviewToolMode) {
    setReviewMode(mode);
    setColorReviewError(null);
    setSelectedCorrectionHoldIds([]);
    setPendingEditColor(null);
  }

  function handleReviewColorPick(color: HoldColor) {
    if (reviewMode === 'add') {
      setPendingAddColor(color);
      setColorReviewError(null);
      return;
    }

    setPendingEditColor(color);
    setColorReviewError(null);
  }

  function handleApplyCorrectionColor() {
    if (!pendingEditColor) {
      setColorReviewError('Select a hold first');
      return;
    }

    handleCorrectionColorChange(pendingEditColor);
  }

  function handleUndoLastReviewStep() {
    setReviewHistory((history) => {
      const previousSnapshot = history[history.length - 1];
      if (!previousSnapshot) {
        return history;
      }

      setCorrectedWallMap(previousSnapshot.wallMap);
      setSelectedCorrectionHoldIds(previousSnapshot.selectedHoldIds);
      setPendingEditColor(null);
      setColorReviewError(null);
      return history.slice(0, -1);
    });
  }

  function handleChooseRetryUpload() {
    setActiveScan(null);
    setCorrectedWallMap(null);
    setScanRetryPrompt(null);
    setMobileStep('capture');
    setScanMode('upload');
    stopStream();
    resetScanSession();
    mediaInputRef.current?.click();
  }

  const reviewScan = useMemo(
    () =>
      displayScan && correctedWallMap
        ? { ...displayScan, availableColors: correctedWallMap.colors, wallMap: correctedWallMap }
        : displayScan,
    [correctedWallMap, displayScan],
  );
  const selectedCorrectionHolds = useMemo(
    () => reviewScan?.wallMap.holds.filter((hold) => selectedCorrectionHoldIds.includes(hold.id)) ?? [],
    [reviewScan?.wallMap.holds, selectedCorrectionHoldIds],
  );
  const selectedCorrectionHold = selectedCorrectionHolds[0] ?? null;
  const selectedCorrectionHoldCount = selectedCorrectionHolds.length;
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
  const hasUndoHistory = reviewHistory.length > 0;

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
      setPendingEditColor(null);
      setSelectedCorrectionHoldIds([]);
      setReviewHistory([]);
      triggerHaptic(24);
      navigate(routes.selectDifficulty);
    } catch (error) {
      setColorReviewError(error instanceof Error ? error.message : 'Unable to save hold color review.');
    } finally {
      setColorReviewSaving(false);
    }
  }
  const scanSafetyDecision = buildScanSafetyDecision(reviewScan);
  const fallbackDescription = scanProgress.error
    ? t('The wall is a little tricky right now. Try again with a steadier phone or brighter light.')
    : localizeAssistText(scanSafetyDecision.detail, language);
  const localizedScanRetryPrompt = localizeAssistText(scanRetryPrompt, language);
  const showScanRetryOverlay = !reviewScan && Boolean(scanRetryPrompt || scanProgress.status === 'error');
  const scanRetryDescription = localizedScanRetryPrompt
    || fallbackDescription
    || t('The scan did not produce a usable wall map. Retake a clearer photo, upload media, or rescan.');
  const localizedScanProgressMessage = localizeAssistText(scanProgress.message, language);
  const localizedScanError = localizeAssistText(scanProgress.error, language);
  const scanAnnouncement = scanProgress.status === 'error'
    ? `${t('Scan paused.')} ${localizedScanError || t('We could not finish this scan.')}`
    : localizedScanProgressMessage;
  const activeReviewColor = reviewMode === 'add'
    ? pendingAddColor
    : pendingEditColor ?? selectedCorrectionHold?.color ?? null;

  useEffect(() => {
    if (
      autoRequestedCameraRef.current ||
      reviewScan ||
      scanMode !== 'live' ||
      stream ||
      !canOpenCameraPermission ||
      scanBusy ||
      cameraRequesting
    ) {
      return;
    }

    autoRequestedCameraRef.current = true;
    void handleRequestCameraAccess();
  }, [cameraRequesting, canOpenCameraPermission, reviewScan, scanBusy, scanMode, stream]);

  useEffect(() => {
    setCorrectedWallMap(null);
    setReviewMode('select');
    setPendingAddColor(displayScan?.availableColors[0] ?? displayScan?.wallMap.colors[0] ?? 'blue');
    setPendingEditColor(null);
    setSelectedCorrectionHoldIds([]);
    setReviewHistory([]);
    setColorReviewError(null);
  }, [displayScan?.id]);

  useEffect(() => {
    if (reviewScan && !scanBusy) {
      setMobileStep('review');
    }
  }, [reviewScan?.id, scanBusy]);

  useEffect(() => {
    if (!reviewScan || reviewMode === 'add') return;

    const validHoldIds = new Set(reviewScan.wallMap.holds.map((hold) => hold.id));
    setSelectedCorrectionHoldIds((currentIds) => currentIds.filter((holdId) => validHoldIds.has(holdId)));
  }, [reviewMode, reviewScan]);

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

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        shouldRestoreCameraOnVisibleRef.current = Boolean(stream && scanMode === 'live' && !reviewScan);
        if (stream) {
          stopStream();
        }
        return;
      }

      if (
        shouldRestoreCameraOnVisibleRef.current &&
        scanMode === 'live' &&
        !reviewScan &&
        canOpenCameraPermission &&
        !cameraRequesting &&
        !scanBusy
      ) {
        shouldRestoreCameraOnVisibleRef.current = false;
        void handleRequestCameraAccess();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [
    cameraRequesting,
    canOpenCameraPermission,
    reviewScan,
    scanBusy,
    scanMode,
    stopStream,
    stream,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePageHide = () => {
      stopStream();
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [stopStream]);

  return (
    <section className={`stack-lg assist-shell ${reviewScan ? 'assist-shell-review-mode' : ''}`.trim()}>
      {!reviewScan ? (
        <>
          <div
            className="assist-scan-console assist-mobile-panel"
            data-mobile-active={mobileStep === 'capture' ? 'true' : 'false'}
          >
            <header className="assist-scan-console-head">
              <span className="assist-scan-kicker">{t('Wall scan workflow')}</span>
              <div className="assist-scan-title-block">
                <h1>{t('Scan the climbing wall')}</h1>
                {simplifiedMode ? null : (
                  <p>{t('Allow camera access, center the wall, then run recognition. Upload is still here as a backup.')}</p>
                )}
              </div>
            </header>

            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {scanAnnouncement}
            </div>

            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={handleUploadSelected}
            />

            <div className="assist-scan-mode-selector" role="group" aria-label={t('Choose scan method')}>
              <button
                type="button"
                className={`assist-scan-mode-option ${scanMode === 'upload' ? 'is-active' : ''}`.trim()}
                aria-pressed={scanMode === 'upload'}
                onClick={() => handleScanModeSelect('upload')}
                disabled={scanBusy}
              >
                <span className="assist-scan-mode-icon" aria-hidden="true">
                  <PhotoIcon />
                </span>
                <span className="assist-scan-mode-copy">
                  <strong>{t('Upload')}</strong>
                  {simplifiedMode ? null : <span>{t('Upload a wall photo or video')}</span>}
                </span>
              </button>
              <button
                type="button"
                className={`assist-scan-mode-option assist-scan-mode-option-live ${scanMode === 'live' ? 'is-active' : ''}`.trim()}
                aria-pressed={scanMode === 'live'}
                onClick={() => handleScanModeSelect('live')}
                disabled={scanBusy || cameraRequesting}
              >
                <span className="assist-scan-mode-icon" aria-hidden="true">
                  <ScanIcon active />
                </span>
                <span className="assist-scan-mode-copy">
                  <strong>{t('Scan Live')}</strong>
                  {simplifiedMode ? null : <span>{t('Open camera and scan the wall directly.')}</span>}
                </span>
              </button>
            </div>

            <div className="assist-scan-method-grid">
              <section
                className={`assist-scan-method assist-scan-camera-card assist-scan-flow-panel is-${cameraStatusTone} is-active`.trim()}
                aria-hidden={false}
                aria-busy={cameraRequesting || scanBusy}
              >
                <div className="assist-scan-method-head">
                  <div className="assist-scan-method-title">
                    <span className="assist-scan-method-number">1</span>
                    <div>
                      <strong>{t('Scan Live')}</strong>
                      {simplifiedMode ? null : (
                        <p>{t('Use the rear camera, keep the wall centered, and scan slowly from lower holds to higher holds for better hold recognition.')}</p>
                      )}
                    </div>
                  </div>
                  <span className={`assist-camera-status-pill is-${cameraStatusTone}`.trim()}>
                    {cameraStatusLabel}
                  </span>
                </div>

                <div className="assist-scan-camera-shell">
                  {scanMode === 'upload' && uploadType && uploadPreviewUrl ? (
                    <div className="assist-upload-preview-frame assist-unified-upload-preview">
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
                  ) : stream ? (
                    <CameraPreview
                      stream={stream}
                      videoRef={videoRef}
                      className="assist-camera-stage assist-camera-stage-natural"
                      label={t('Camera preview for wall recognition')}
                      syncAspectRatio
                      fallbackAspectRatio="3 / 4"
                      fitWithinContainer
                      showMask
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
                  ) : (
                    <button
                      type="button"
                      className="assist-camera-permission-target"
                      onClick={() => void handleRequestCameraAccess()}
                      disabled={!canOpenCameraPermission || scanBusy || cameraRequesting}
                    >
                      <span className="assist-camera-permission-icon" aria-hidden="true" />
                      <strong>{cameraRequesting ? t('Opening camera...') : t('Tap to allow camera')}</strong>
                      <span>{cameraPermissionDescription}</span>
                    </button>
                  )}
                </div>

                <div className="assist-scan-steps" aria-label={t('Camera scan steps')}>
                  <span><strong>1</strong>{t('Allow camera')}</span>
                  <span><strong>2</strong>{t('Center the wall')}</span>
                  <span><strong>3</strong>{t('Confirm scan')}</span>
                </div>

                <div className="assist-scan-primary-actions">
                  {scanMode === 'upload' && uploadType ? (
                    <>
                      <Button
                        className="assist-scan-confirm-button"
                        onClick={() => void handleUploadScan()}
                        disabled={scanBusy}
                        fullWidth
                      >
                        {t('Scan uploaded media')}
                      </Button>
                      <Button variant="secondary" onClick={() => mediaInputRef.current?.click()} disabled={scanBusy}>
                        {uploadType ? t('Replace media') : t('Choose media')}
                      </Button>
                    </>
                  ) : stream ? (
                    <>
                      <Button
                        className="assist-scan-confirm-button"
                        onClick={() => void handleScan('camera')}
                        disabled={!canOpenCameraPermission || scanBusy}
                        fullWidth
                      >
                        {t('Scan with camera')}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void handleRequestCameraAccess(true)}
                        disabled={!canOpenCameraPermission || scanBusy || cameraRequesting}
                      >
                        {cameraRequesting ? t('Opening camera...') : t('Refresh camera')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="assist-camera-switch-button"
                        onClick={() => void handleSwitchCamera()}
                        disabled={!canOpenCameraPermission || scanBusy || cameraRequesting}
                      >
                        {t('Switch camera')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="assist-scan-confirm-button"
                      onClick={() => void handleRequestCameraAccess()}
                      disabled={!canOpenCameraPermission || scanBusy || cameraRequesting}
                      fullWidth
                    >
                      {cameraRequesting ? t('Opening camera...') : t('Allow camera')}
                    </Button>
                  )}
                </div>

                {cameraRequestFailed || (cameraError && !stream) ? (
                  <p className="assist-camera-access-error" role="alert">
                    {localizedCameraMessage || t('Camera permission did not open. Check browser permission and try again.')}
                  </p>
                ) : null}
                {cameraNotice && stream ? (
                  <p className="assist-camera-access-warning" role="status">
                    {localizedCameraMessage}
                  </p>
                ) : null}
              </section>

            </div>

            {showScanRetryOverlay ? (
              <div
                className="assist-scan-retry-overlay"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="scan-retry-title"
                aria-describedby="scan-retry-description"
              >
                <div className="assist-scan-retry-dialog">
                  <AssistMascotSticker variant="flashlight" className="assist-warning-mascot" />
                  <div className="stack-sm">
                    <strong id="scan-retry-title">{t('Scan did not work')}</strong>
                    <p id="scan-retry-description">{scanRetryDescription}</p>
                    <div className="assist-scan-retry-actions">
                      <Button variant="secondary" onClick={handleChooseRetryUpload}>
                        {t('Upload a clearer photo or video')}
                      </Button>
                      <Button onClick={() => void handleRetakeScan()}>
                        {t('Retake scan')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
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
                  selectedHoldIds={selectedCorrectionHoldIds}
                  selectedHoldColor={reviewMode === 'select' && pendingEditColor ? pendingEditColor : undefined}
                  onHoldSelect={reviewMode === 'add' ? undefined : handleCorrectionHoldSelect}
                  onCanvasSelect={reviewMode === 'add' ? handleAddHoldAtPosition : undefined}
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
              </div>

              <div className="assist-color-picker-shell">
                {reviewMode === 'delete' ? (
                  <div className="assist-review-delete-actions">
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleDeleteSelectedHold}
                      disabled={colorReviewSaving || selectedCorrectionHoldCount === 0}
                    >
                      {selectedCorrectionHoldCount > 1 ? t('Delete selected holds') : t('Delete selected hold')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="assist-color-swatch-grid" role="group" aria-label={t('Choose corrected hold color')}>
                      {HOLD_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`assist-color-swatch assist-color-swatch-${color} ${activeReviewColor === color ? 'is-active' : ''}`.trim()}
                          aria-pressed={activeReviewColor === color}
                          onClick={() => handleReviewColorPick(color)}
                        >
                          <span className="assist-color-swatch-mark" aria-hidden="true" />
                          <span className="assist-color-swatch-label">
                            {formatHoldColor(color, language, true)}
                          </span>
                        </button>
                      ))}
                    </div>
                    {reviewMode === 'select' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="assist-color-apply-button"
                        onClick={handleApplyCorrectionColor}
                        disabled={colorReviewSaving || selectedCorrectionHoldCount === 0 || !pendingEditColor}
                      >
                        {selectedCorrectionHoldCount > 1
                          ? t('Apply color to selected holds')
                          : t('Apply color')}
                      </Button>
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
                  onClick={handleUndoLastReviewStep}
                  disabled={!hasUndoHistory || colorReviewSaving}
                >
                  {t('Undo')}
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
        </>
      )}
    </section>
  );
}
