import { useEffect, useRef, useState } from 'react';
import type { PoseLandmark } from '../../../shared/lib/mediapipePose';
import {
  createPoseTracker,
  type PoseFrame,
  type PoseJointName,
  type PosePoint,
  type PoseTrackerRuntimeOptions,
} from '../services/poseTracker.service';
import {
  createPoseSubjectLockState,
  stabilizePoseSubjectFrame,
  type PoseSubjectLockMeta,
  type PoseSubjectLockStatus,
} from '../services/poseSubjectLock.service';

export interface PoseAnchor {
  xPct: number;
  yPct: number;
  visibility: number;
}

type AnchorKey = 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot' | 'center';
type PoseAnchors = Partial<Record<AnchorKey, PoseAnchor>>;

export interface LivePoseState {
  supported: boolean;
  loading: boolean;
  active: boolean;
  error: string | null;
  statusLabel: string;
  landmarks: PoseLandmark[];
  anchors: PoseAnchors;
  poseFrame: PoseFrame | null;
  poseQualityPct: number;
  visibleLimbCount: number;
  visibleJointCount: number;
  trackedJointCount: number;
  subjectLockStatus: PoseSubjectLockStatus;
  subjectLockConfidencePct: number;
  interferenceRiskPct: number;
  subjectLockReason: string;
}

interface PoseFrameState {
  landmarks: PoseLandmark[];
  anchors: PoseAnchors;
  active: boolean;
  poseFrame: PoseFrame | null;
  poseQualityPct: number;
  visibleLimbCount: number;
  visibleJointCount: number;
  trackedJointCount: number;
  subjectLockStatus: PoseSubjectLockStatus;
  subjectLockConfidencePct: number;
  interferenceRiskPct: number;
  subjectLockReason: string;
}

const UI_SYNC_INTERVAL_MS = 120;
const MIN_VISIBLE_POINT = 0.35;
const DISPLAY_JOINTS: PoseJointName[] = [
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftHandContact',
  'rightHandContact',
  'leftFootContact',
  'rightFootContact',
];

function toAnchor(point?: PosePoint): PoseAnchor | null {
  if (!point || point.visibility < MIN_VISIBLE_POINT) return null;

  return {
    xPct: Number(point.xPct.toFixed(2)),
    yPct: Number(point.yPct.toFixed(2)),
    visibility: Number(point.visibility.toFixed(2)),
  };
}

function buildPoseRuntimeProfile(): Required<PoseTrackerRuntimeOptions> & {
  inferenceIntervalMs: number;
  maxInputWidth: number;
} {
  if (typeof navigator === 'undefined') {
    return {
      modelComplexity: 1,
      minDetectionConfidence: 0.58,
      minTrackingConfidence: 0.62,
      inferenceIntervalMs: 100,
      maxInputWidth: 540,
    };
  }

  const runtimeNavigator = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  };

  const cores = runtimeNavigator.hardwareConcurrency ?? 4;
  const deviceMemory = runtimeNavigator.deviceMemory ?? 4;
  const saveData = Boolean(runtimeNavigator.connection?.saveData);
  const constrainedNetwork = ['slow-2g', '2g'].includes(runtimeNavigator.connection?.effectiveType ?? '');

  if (saveData || constrainedNetwork || deviceMemory <= 4 || cores <= 4) {
    return {
      modelComplexity: 1,
      minDetectionConfidence: 0.56,
      minTrackingConfidence: 0.6,
      inferenceIntervalMs: 125,
      maxInputWidth: 480,
    };
  }

  if (deviceMemory <= 6 || cores <= 6) {
    return {
      modelComplexity: 1,
      minDetectionConfidence: 0.58,
      minTrackingConfidence: 0.62,
      inferenceIntervalMs: 105,
      maxInputWidth: 540,
    };
  }

  return {
    modelComplexity: 2,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.65,
    inferenceIntervalMs: 90,
    maxInputWidth: 640,
  };
}

function buildAnchors(poseFrame: PoseFrame | null): PoseAnchors {
  const leftHand = toAnchor(poseFrame?.joints.leftHandContact ?? poseFrame?.joints.leftWrist);
  const rightHand = toAnchor(poseFrame?.joints.rightHandContact ?? poseFrame?.joints.rightWrist);
  const leftFoot = toAnchor(poseFrame?.joints.leftFootContact ?? poseFrame?.joints.leftAnkle);
  const rightFoot = toAnchor(poseFrame?.joints.rightFootContact ?? poseFrame?.joints.rightAnkle);
  const torsoPoints = [
    toAnchor(poseFrame?.joints.leftShoulder),
    toAnchor(poseFrame?.joints.rightShoulder),
    toAnchor(poseFrame?.joints.leftHip),
    toAnchor(poseFrame?.joints.rightHip),
  ].filter(Boolean) as PoseAnchor[];

  const center =
    torsoPoints.length > 0
      ? {
          xPct: Number(
            (torsoPoints.reduce((sum, point) => sum + point.xPct, 0) / torsoPoints.length).toFixed(2),
          ),
          yPct: Number(
            (torsoPoints.reduce((sum, point) => sum + point.yPct, 0) / torsoPoints.length).toFixed(2),
          ),
          visibility: Number(
            (torsoPoints.reduce((sum, point) => sum + point.visibility, 0) / torsoPoints.length).toFixed(2),
          ),
        }
      : null;

  return {
    leftHand: leftHand ?? undefined,
    rightHand: rightHand ?? undefined,
    leftFoot: leftFoot ?? undefined,
    rightFoot: rightFoot ?? undefined,
    center: center ?? undefined,
  };
}

function buildDisplayLandmarks(poseFrame: PoseFrame | null) {
  if (!poseFrame) return [];

  return DISPLAY_JOINTS.flatMap((jointName) => {
    const point = poseFrame.joints[jointName];
    if (!point || point.visibility < 0.2) return [];

    return [
      {
        x: Number((point.xPct / 100).toFixed(4)),
        y: Number((point.yPct / 100).toFixed(4)),
        visibility: Number(point.visibility.toFixed(2)),
      } satisfies PoseLandmark,
    ];
  });
}

function buildUiFrame(poseFrame: PoseFrame | null, lockMeta?: PoseSubjectLockMeta): PoseFrameState {
  const metrics = poseFrame?.metrics;
  const subjectLockStatus = lockMeta?.status ?? 'searching';
  const subjectLockConfidencePct = lockMeta?.confidencePct ?? 0;
  const interferenceRiskPct = lockMeta?.interferenceRiskPct ?? 0;
  const subjectLockReason = lockMeta?.statusLabel ?? 'Searching for the primary climber';

  return {
    landmarks: buildDisplayLandmarks(poseFrame),
    anchors: buildAnchors(poseFrame),
    active: Boolean(
      poseFrame &&
        subjectLockStatus !== 'searching' &&
        ((metrics?.visibleLimbCount ?? 0) >= 1 || (metrics?.visibleJointCount ?? 0) >= 6),
    ),
    poseFrame,
    poseQualityPct: metrics?.frameQualityPct ?? 0,
    visibleLimbCount: metrics?.visibleLimbCount ?? 0,
    visibleJointCount: metrics?.visibleJointCount ?? 0,
    trackedJointCount: metrics?.trackedJointCount ?? 0,
    subjectLockStatus,
    subjectLockConfidencePct,
    interferenceRiskPct,
    subjectLockReason,
  };
}

const EMPTY_FRAME: PoseFrameState = {
  landmarks: [],
  anchors: {},
  active: false,
  poseFrame: null,
  poseQualityPct: 0,
  visibleLimbCount: 0,
  visibleJointCount: 0,
  trackedJointCount: 0,
  subjectLockStatus: 'searching',
  subjectLockConfidencePct: 0,
  interferenceRiskPct: 0,
  subjectLockReason: 'Searching for the primary climber',
};

export function useLivePoseTracker(videoElement: HTMLVideoElement | null, enabled = true) {
  const trackerRef = useRef<Awaited<ReturnType<typeof createPoseTracker>> | null>(null);
  const frameHandleRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const latestFrameRef = useRef<PoseFrameState>(EMPTY_FRAME);
  const lastInferenceAtRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false);
  const subjectLockStateRef = useRef(createPoseSubjectLockState());
  const runtimeProfileRef = useRef(buildPoseRuntimeProfile());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uiFrame, setUiFrame] = useState<PoseFrameState>(EMPTY_FRAME);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !videoElement || typeof window === 'undefined') {
      setUiFrame(EMPTY_FRAME);
      setError(null);
      setLoading(false);
      subjectLockStateRef.current = createPoseSubjectLockState();
      return undefined;
    }

    const video = videoElement;
    let disposed = false;
    const runtimeProfile = runtimeProfileRef.current;

    async function boot() {
      try {
        setLoading(true);
        setError(null);
        latestFrameRef.current = EMPTY_FRAME;
        lastInferenceAtRef.current = 0;
        lastVideoTimeRef.current = -1;
        subjectLockStateRef.current = createPoseSubjectLockState();

        const tracker = await createPoseTracker({
          modelComplexity: runtimeProfile.modelComplexity,
          minDetectionConfidence: runtimeProfile.minDetectionConfidence,
          minTrackingConfidence: runtimeProfile.minTrackingConfidence,
        });
        if (disposed) return;

        trackerRef.current = tracker;
        workCanvasRef.current = document.createElement('canvas');

        syncTimerRef.current = window.setInterval(() => {
          if (disposed || !mountedRef.current) return;
          setUiFrame(latestFrameRef.current);
        }, UI_SYNC_INTERVAL_MS);

        const tick = async () => {
          if (disposed) return;

          frameHandleRef.current = window.requestAnimationFrame(tick);

          if (!trackerRef.current || busyRef.current) return;
          if (document.hidden) return;
          if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

          const now = performance.now();
          if (now - lastInferenceAtRef.current < runtimeProfile.inferenceIntervalMs) return;
          if (video.currentTime === lastVideoTimeRef.current) return;

          const canvas = workCanvasRef.current;
          if (!canvas) return;

          const scale = Math.min(1, runtimeProfile.maxInputWidth / video.videoWidth);
          const width = Math.max(1, Math.round(video.videoWidth * scale));
          const height = Math.max(1, Math.round(video.videoHeight * scale));

          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }

          const context = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
          if (!context) return;

          context.drawImage(video, 0, 0, width, height);

          busyRef.current = true;
          lastInferenceAtRef.current = now;
          lastVideoTimeRef.current = video.currentTime;

          try {
            const nextPoseFrame = await trackerRef.current.estimate(canvas);
            const lockedFrame = stabilizePoseSubjectFrame(
              nextPoseFrame,
              subjectLockStateRef.current,
            );
            subjectLockStateRef.current = lockedFrame.nextState;
            latestFrameRef.current = buildUiFrame(lockedFrame.frame, lockedFrame.meta);
          } catch (poseError) {
            if (!disposed && mountedRef.current) {
              setError(poseError instanceof Error ? poseError.message : 'Pose tracking failed.');
            }
          } finally {
            busyRef.current = false;
          }
        };

        frameHandleRef.current = window.requestAnimationFrame(tick);
      } catch (poseError) {
        if (!disposed && mountedRef.current) {
          setError(poseError instanceof Error ? poseError.message : 'Unable to start pose tracking.');
        }
      } finally {
        if (!disposed && mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void boot();

    return () => {
      disposed = true;

      if (frameHandleRef.current !== null) {
        window.cancelAnimationFrame(frameHandleRef.current);
        frameHandleRef.current = null;
      }

      if (syncTimerRef.current !== null) {
        window.clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }

      trackerRef.current?.dispose();
      trackerRef.current = null;
      workCanvasRef.current = null;
      latestFrameRef.current = EMPTY_FRAME;
      busyRef.current = false;
      subjectLockStateRef.current = createPoseSubjectLockState();

      if (mountedRef.current) {
        setUiFrame(EMPTY_FRAME);
      }
    };
  }, [enabled, videoElement]);

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia;

  const statusLabel = error
    ? 'Pose tracker unavailable'
    : loading
      ? 'Starting pose tracker'
      : uiFrame.subjectLockReason;

  return {
    supported,
    loading,
    active: uiFrame.active,
    error,
    statusLabel,
    landmarks: uiFrame.landmarks,
    anchors: uiFrame.anchors,
    poseFrame: uiFrame.poseFrame,
    poseQualityPct: uiFrame.poseQualityPct,
    visibleLimbCount: uiFrame.visibleLimbCount,
    visibleJointCount: uiFrame.visibleJointCount,
    trackedJointCount: uiFrame.trackedJointCount,
    subjectLockStatus: uiFrame.subjectLockStatus,
    subjectLockConfidencePct: uiFrame.subjectLockConfidencePct,
    interferenceRiskPct: uiFrame.interferenceRiskPct,
    subjectLockReason: uiFrame.subjectLockReason,
  } satisfies LivePoseState;
}
