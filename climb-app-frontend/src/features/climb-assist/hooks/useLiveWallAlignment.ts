import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  runVisionPlanarCalibrationApi,
  type AlignmentPointPct,
  type CalibratedHold,
} from '../../../shared/api/vision.api';
import type { Hold, RoutePlan, WallMap } from '../../../shared/types/climb';

type AlignmentStatus = 'idle' | 'aligning' | 'locked' | 'partial' | 'unavailable';

export interface LiveWallAlignmentState {
  status: AlignmentStatus;
  statusLabel: string;
  qualityPct: number;
  detector: string;
  matchCount: number;
  inlierCount: number;
  inlierRatio: number;
  active: boolean;
  error: string | null;
  projectedReferenceQuadPct: AlignmentPointPct[];
  alignedHoldMap: Record<string, CalibratedHold>;
}

const ALIGNMENT_INTERVAL_MS = 1400;
const MAX_FRAME_DIMENSION = 720;
const FRAME_QUALITY = 0.66;
const REFERENCE_MAX_DIMENSION = 720;
const REFERENCE_QUALITY = 0.68;
const HOLD_BLEND_ALPHA = 0.4;
const HOLD_STALE_GRACE_MS = 5500;

const EMPTY_ALIGNMENT_STATE: LiveWallAlignmentState = {
  status: 'idle',
  statusLabel: 'Waiting for wall alignment',
  qualityPct: 0,
  detector: '',
  matchCount: 0,
  inlierCount: 0,
  inlierRatio: 0,
  active: false,
  error: null,
  projectedReferenceQuadPct: [],
  alignedHoldMap: {},
};

function captureElementPreview(
  element: HTMLVideoElement | HTMLImageElement,
  maxDimension: number,
  quality: number,
) {
  const sourceWidth = 'videoWidth' in element ? element.videoWidth : element.naturalWidth;
  const sourceHeight = 'videoHeight' in element ? element.videoHeight : element.naturalHeight;

  if (!sourceWidth || !sourceHeight) return null;

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(element, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function normalizeReferenceImage(imageSource: string) {
  if (!imageSource) return null;
  if (imageSource.startsWith('data:image/')) return imageSource;

  return new Promise<string | null>((resolve) => {
    const image = new Image();
    if (!imageSource.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      resolve(captureElementPreview(image, REFERENCE_MAX_DIMENSION, REFERENCE_QUALITY));
    };
    image.onerror = () => resolve(null);
    image.src = imageSource;
  });
}

function blendValue(previousValue: number | undefined, nextValue: number | undefined, alpha = HOLD_BLEND_ALPHA) {
  if (typeof nextValue !== 'number') return previousValue;
  if (typeof previousValue !== 'number') return nextValue;
  return Number((previousValue + (nextValue - previousValue) * alpha).toFixed(2));
}

function blendPoints(
  previousPoints: AlignmentPointPct[] | undefined,
  nextPoints: AlignmentPointPct[] | undefined,
  alpha = HOLD_BLEND_ALPHA,
) {
  if (!nextPoints?.length) return previousPoints;
  if (!previousPoints?.length || previousPoints.length !== nextPoints.length) return nextPoints;

  return nextPoints.map((point, index) => ({
    xPct: blendValue(previousPoints[index]?.xPct, point.xPct, alpha) ?? point.xPct,
    yPct: blendValue(previousPoints[index]?.yPct, point.yPct, alpha) ?? point.yPct,
  }));
}

function blendHold(previousHold: CalibratedHold | undefined, nextHold: CalibratedHold): CalibratedHold {
  if (!previousHold) return nextHold;

  return {
    ...nextHold,
    xPct: blendValue(previousHold.xPct, nextHold.xPct) ?? nextHold.xPct,
    yPct: blendValue(previousHold.yPct, nextHold.yPct) ?? nextHold.yPct,
    x1Pct: blendValue(previousHold.x1Pct, nextHold.x1Pct),
    y1Pct: blendValue(previousHold.y1Pct, nextHold.y1Pct),
    x2Pct: blendValue(previousHold.x2Pct, nextHold.x2Pct),
    y2Pct: blendValue(previousHold.y2Pct, nextHold.y2Pct),
    radiusPct: blendValue(previousHold.radiusPct, nextHold.radiusPct),
    projectedQuadPct: blendPoints(previousHold.projectedQuadPct, nextHold.projectedQuadPct),
  };
}

function buildStatusLabel(status: AlignmentStatus, qualityPct: number, error: string | null) {
  if (error) return 'Wall alignment unavailable';
  if (status === 'locked') return `Wall alignment locked (${qualityPct}%)`;
  if (status === 'partial') return `Wall alignment stabilising (${qualityPct}%)`;
  if (status === 'aligning') return 'Aligning scanned wall to the live camera';
  if (status === 'unavailable') return 'Wall alignment unavailable';
  return 'Waiting for wall alignment';
}

function buildAlignedRoutePlan(
  routePlan: RoutePlan | null | undefined,
  alignedHoldMap: Record<string, CalibratedHold>,
) {
  if (!routePlan) return null;
  if (Object.keys(alignedHoldMap).length === 0) return routePlan;

  return {
    ...routePlan,
    holds: routePlan.holds.map((hold) => alignedHoldMap[hold.id] ?? hold),
  };
}

function buildAlignedHold(
  hold: Hold | null,
  alignedHoldMap: Record<string, CalibratedHold>,
) {
  if (!hold) return null;
  return alignedHoldMap[hold.id] ?? hold;
}

export function useLiveWallAlignment({
  videoElement,
  referenceImageUrl,
  wallMap,
  routePlan,
  currentHold,
  enabled = true,
}: {
  videoElement: HTMLVideoElement | null;
  referenceImageUrl?: string | null;
  wallMap?: WallMap | null;
  routePlan?: RoutePlan | null;
  currentHold?: Hold | null;
  enabled?: boolean;
}) {
  const [alignmentState, setAlignmentState] = useState<LiveWallAlignmentState>(EMPTY_ALIGNMENT_STATE);
  const alignmentRef = useRef(EMPTY_ALIGNMENT_STATE);
  const referenceImageDataUrlRef = useRef<string | null>(null);
  const disposedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastSuccessAtRef = useRef(0);

  const requiresReferenceAlignment = Boolean(wallMap && wallMap.source !== 'demo');
  const hasReferenceData = Boolean(requiresReferenceAlignment && referenceImageUrl && wallMap?.holds.length);

  useEffect(() => {
    alignmentRef.current = alignmentState;
  }, [alignmentState]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!referenceImageUrl) {
      referenceImageDataUrlRef.current = null;
      return undefined;
    }

    void normalizeReferenceImage(referenceImageUrl).then((normalizedImage) => {
      if (cancelled) return;
      referenceImageDataUrlRef.current = normalizedImage;
    });

    return () => {
      cancelled = true;
    };
  }, [referenceImageUrl]);

  const applyUnavailableState = useCallback((error: string | null) => {
    const previous = alignmentRef.current;
    const now = Date.now();
    const keepPreviousAlignment =
      previous.active &&
      now - lastSuccessAtRef.current < HOLD_STALE_GRACE_MS &&
      Object.keys(previous.alignedHoldMap).length > 0;

    const nextState: LiveWallAlignmentState = keepPreviousAlignment
      ? {
          ...previous,
          status: 'partial',
          statusLabel: 'Holding the last wall alignment lock',
          error,
        }
      : {
          ...EMPTY_ALIGNMENT_STATE,
          status: 'unavailable',
          statusLabel: buildStatusLabel('unavailable', 0, error),
          error,
        };

    alignmentRef.current = nextState;
    setAlignmentState(nextState);
  }, []);

  const runCalibration = useCallback(async (force = false) => {
    if (!enabled || !videoElement || !wallMap?.holds.length) return;
    if (busyRef.current) return;
    if (!referenceImageDataUrlRef.current) {
      applyUnavailableState('The scan reference image is not ready for wall alignment.');
      return;
    }
    if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return;
    if (!force && videoElement.currentTime === lastVideoTimeRef.current) return;

    const frameImageDataUrl = captureElementPreview(videoElement, MAX_FRAME_DIMENSION, FRAME_QUALITY);
    if (!frameImageDataUrl) return;

    busyRef.current = true;
    lastVideoTimeRef.current = videoElement.currentTime;

    const aligningState: LiveWallAlignmentState = {
      ...alignmentRef.current,
      status: alignmentRef.current.active ? alignmentRef.current.status : 'aligning',
      statusLabel: buildStatusLabel('aligning', alignmentRef.current.qualityPct, null),
      error: null,
    };
    alignmentRef.current = aligningState;
    setAlignmentState(aligningState);

    try {
      const result = await runVisionPlanarCalibrationApi({
        referenceImageDataUrl: referenceImageDataUrlRef.current,
        frameImageDataUrl,
        wallMap,
      });

      if (disposedRef.current) return;

      if (result.status === 'unavailable' || result.alignedHolds.length === 0) {
        applyUnavailableState(result.message || 'Wall alignment is not reliable yet.');
        return;
      }

      const previousMap = alignmentRef.current.alignedHoldMap;
      const nextAlignedHoldMap = result.alignedHolds.reduce<Record<string, CalibratedHold>>((accumulator, hold) => {
        accumulator[hold.id] = blendHold(previousMap[hold.id], hold);
        return accumulator;
      }, {});

      lastSuccessAtRef.current = Date.now();

      const nextState: LiveWallAlignmentState = {
        status: result.status,
        statusLabel: buildStatusLabel(result.status, result.qualityPct, null),
        qualityPct: result.qualityPct,
        detector: result.detector,
        matchCount: result.matchCount,
        inlierCount: result.inlierCount,
        inlierRatio: result.inlierRatio,
        active: true,
        error: null,
        projectedReferenceQuadPct: blendPoints(
          alignmentRef.current.projectedReferenceQuadPct,
          result.projectedReferenceQuadPct,
          0.32,
        ) ?? [],
        alignedHoldMap: nextAlignedHoldMap,
      };

      alignmentRef.current = nextState;
      setAlignmentState(nextState);
    } catch (error) {
      if (disposedRef.current) return;
      const message = error instanceof Error ? error.message : 'Wall alignment failed.';
      applyUnavailableState(message);
    } finally {
      busyRef.current = false;
    }
  }, [applyUnavailableState, enabled, videoElement, wallMap]);

  useEffect(() => {
    if (!enabled || !videoElement || !wallMap?.holds.length || !requiresReferenceAlignment) {
      const nextState = hasReferenceData
        ? EMPTY_ALIGNMENT_STATE
        : {
            ...EMPTY_ALIGNMENT_STATE,
            ...(requiresReferenceAlignment
              ? {
                  status: 'unavailable' as const,
                  statusLabel: 'Scan reference image unavailable',
                  error: referenceImageUrl ? 'The wall map is missing hold data.' : 'No scanned wall reference image is available.',
                }
              : {}),
          };
      alignmentRef.current = nextState;
      setAlignmentState(nextState);
      return undefined;
    }

    let cancelled = false;

    const schedule = (delayMs = ALIGNMENT_INTERVAL_MS) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(async () => {
        if (cancelled) return;
        await runCalibration();
        if (cancelled) return;
        schedule(ALIGNMENT_INTERVAL_MS);
      }, delayMs);
    };

    schedule(80);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, hasReferenceData, referenceImageUrl, requiresReferenceAlignment, runCalibration, videoElement, wallMap]);

  const recalibrate = useCallback(async () => {
    await runCalibration(true);
  }, [runCalibration]);

  const alignedRoutePlan = useMemo(
    () => buildAlignedRoutePlan(routePlan, alignmentState.alignedHoldMap),
    [alignmentState.alignedHoldMap, routePlan],
  );

  const alignedCurrentHold = useMemo(
    () => buildAlignedHold(currentHold ?? null, alignmentState.alignedHoldMap),
    [alignmentState.alignedHoldMap, currentHold],
  );

  return {
    alignmentState,
    alignedRoutePlan,
    alignedCurrentHold,
    recalibrate,
  };
}
