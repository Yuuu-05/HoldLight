import type { PoseFrame, PoseJointName, PosePoint } from './poseTracker.service';

export type PoseSubjectLockStatus = 'searching' | 'locked' | 'holding' | 'reacquiring';

export interface PoseSubjectLockMeta {
  status: PoseSubjectLockStatus;
  confidencePct: number;
  interferenceRiskPct: number;
  statusLabel: string;
}

interface PoseSubjectSignature {
  centerXPct: number;
  centerYPct: number;
  torsoXPct: number;
  torsoYPct: number;
  bodyHeightPct: number;
  bodyWidthPct: number;
  shoulderSpanPct: number;
  hipSpanPct: number;
}

export interface PoseSubjectLockState {
  signature: PoseSubjectSignature | null;
  lastAcceptedFrame: PoseFrame | null;
  lastAcceptedAt: number;
  mismatchStreak: number;
  lostStreak: number;
}

const VISIBLE_THRESHOLD = 0.32;
const MIN_LOCK_QUALITY_PCT = 48;
const MIN_LOCK_VISIBLE_JOINTS = 6;
const LOCK_HOLD_MS = 2400;
const REACQUIRE_MS = 2800;
const MAX_MISMATCH_STREAK = 6;
const FRAME_HOLD_DECAY = 0.96;

const SIGNATURE_JOINTS: PoseJointName[] = [
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftFootContact',
  'rightFootContact',
];

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getVisiblePoint(
  joints: Partial<Record<PoseJointName, PosePoint>>,
  jointName: PoseJointName,
  threshold = VISIBLE_THRESHOLD,
) {
  const point = joints[jointName];
  if (!point || point.visibility < threshold) return null;
  return point;
}

function averagePoints(points: PosePoint[]) {
  return {
    xPct: points.reduce((sum, point) => sum + point.xPct, 0) / Math.max(1, points.length),
    yPct: points.reduce((sum, point) => sum + point.yPct, 0) / Math.max(1, points.length),
  };
}

function buildSubjectSignature(frame: PoseFrame | null): PoseSubjectSignature | null {
  if (!frame) return null;

  const visiblePoints = SIGNATURE_JOINTS
    .map((jointName) => getVisiblePoint(frame.joints, jointName))
    .filter(Boolean) as PosePoint[];

  if (visiblePoints.length < 4) {
    return null;
  }

  const shoulders = [
    getVisiblePoint(frame.joints, 'leftShoulder'),
    getVisiblePoint(frame.joints, 'rightShoulder'),
  ].filter(Boolean) as PosePoint[];
  const hips = [
    getVisiblePoint(frame.joints, 'leftHip'),
    getVisiblePoint(frame.joints, 'rightHip'),
  ].filter(Boolean) as PosePoint[];

  const center = averagePoints(visiblePoints);
  const torsoSource = [...shoulders, ...hips];
  const torsoCenter = torsoSource.length > 0 ? averagePoints(torsoSource) : center;

  const xValues = visiblePoints.map((point) => point.xPct);
  const yValues = visiblePoints.map((point) => point.yPct);
  const leftShoulder = getVisiblePoint(frame.joints, 'leftShoulder');
  const rightShoulder = getVisiblePoint(frame.joints, 'rightShoulder');
  const leftHip = getVisiblePoint(frame.joints, 'leftHip');
  const rightHip = getVisiblePoint(frame.joints, 'rightHip');

  const shoulderSpanPct =
    leftShoulder && rightShoulder ? Math.abs(rightShoulder.xPct - leftShoulder.xPct) : Math.max(8, Math.max(...xValues) - Math.min(...xValues));
  const hipSpanPct =
    leftHip && rightHip ? Math.abs(rightHip.xPct - leftHip.xPct) : Math.max(8, Math.max(...xValues) - Math.min(...xValues));

  return {
    centerXPct: center.xPct,
    centerYPct: center.yPct,
    torsoXPct: torsoCenter.xPct,
    torsoYPct: torsoCenter.yPct,
    bodyHeightPct: Math.max(10, Math.max(...yValues) - Math.min(...yValues)),
    bodyWidthPct: Math.max(8, Math.max(...xValues) - Math.min(...xValues)),
    shoulderSpanPct: Math.max(6, shoulderSpanPct),
    hipSpanPct: Math.max(6, hipSpanPct),
  };
}

function isLockableFrame(frame: PoseFrame | null, signature: PoseSubjectSignature | null) {
  return Boolean(
    frame &&
      signature &&
      frame.metrics.frameQualityPct >= MIN_LOCK_QUALITY_PCT &&
      frame.metrics.visibleJointCount >= MIN_LOCK_VISIBLE_JOINTS,
  );
}

function buildHeldFrame(frame: PoseFrame | null) {
  if (!frame) return null;

  const joints = Object.entries(frame.joints).reduce<PoseFrame['joints']>((accumulator, [jointName, point]) => {
    if (!point || point.visibility <= 0.08) return accumulator;

    accumulator[jointName as PoseJointName] = {
      xPct: point.xPct,
      yPct: point.yPct,
      visibility: Number(Math.max(0.08, point.visibility * FRAME_HOLD_DECAY).toFixed(2)),
    };
    return accumulator;
  }, {});

  return {
    ...frame,
    timestamp: Date.now(),
    joints,
    metrics: {
      ...frame.metrics,
      visibleJointCount: Object.values(joints).filter((point) => (point?.visibility ?? 0) >= VISIBLE_THRESHOLD).length,
      trackedJointCount: Object.keys(joints).length,
    },
  };
}

function blendSignature(previous: PoseSubjectSignature, next: PoseSubjectSignature): PoseSubjectSignature {
  return {
    centerXPct: previous.centerXPct + (next.centerXPct - previous.centerXPct) * 0.35,
    centerYPct: previous.centerYPct + (next.centerYPct - previous.centerYPct) * 0.35,
    torsoXPct: previous.torsoXPct + (next.torsoXPct - previous.torsoXPct) * 0.3,
    torsoYPct: previous.torsoYPct + (next.torsoYPct - previous.torsoYPct) * 0.3,
    bodyHeightPct: previous.bodyHeightPct + (next.bodyHeightPct - previous.bodyHeightPct) * 0.22,
    bodyWidthPct: previous.bodyWidthPct + (next.bodyWidthPct - previous.bodyWidthPct) * 0.22,
    shoulderSpanPct: previous.shoulderSpanPct + (next.shoulderSpanPct - previous.shoulderSpanPct) * 0.25,
    hipSpanPct: previous.hipSpanPct + (next.hipSpanPct - previous.hipSpanPct) * 0.25,
  };
}

function compareSignature(candidate: PoseSubjectSignature, locked: PoseSubjectSignature) {
  const baseScale = Math.max(
    12,
    locked.bodyHeightPct,
    candidate.bodyHeightPct,
    locked.bodyWidthPct,
    candidate.bodyWidthPct,
  );
  const centerShift = Math.hypot(candidate.centerXPct - locked.centerXPct, candidate.centerYPct - locked.centerYPct) / baseScale;
  const torsoShift = Math.hypot(candidate.torsoXPct - locked.torsoXPct, candidate.torsoYPct - locked.torsoYPct) / baseScale;
  const shoulderScaleDelta = Math.abs(candidate.shoulderSpanPct / Math.max(1, locked.shoulderSpanPct) - 1);
  const hipScaleDelta = Math.abs(candidate.hipSpanPct / Math.max(1, locked.hipSpanPct) - 1);
  const bodyScaleDelta = Math.abs(candidate.bodyHeightPct / Math.max(1, locked.bodyHeightPct) - 1);
  const scaleDelta = Math.max(shoulderScaleDelta, hipScaleDelta, bodyScaleDelta);

  const mismatchScore = centerShift * 0.52 + torsoShift * 0.28 + scaleDelta * 0.2;
  const confidencePct = clampPercent((1 - Math.min(1, mismatchScore / 0.74)) * 100);
  const interferenceRiskPct = clampPercent((Math.min(1, mismatchScore / 0.58)) * 100);
  const accepted = centerShift <= 0.56 && torsoShift <= 0.42 && scaleDelta <= 0.78;

  return {
    accepted,
    confidencePct,
    interferenceRiskPct,
  };
}

function buildMeta(status: PoseSubjectLockStatus, confidencePct: number, interferenceRiskPct: number): PoseSubjectLockMeta {
  const statusLabel =
    status === 'locked'
      ? 'Pose tracker locked on the active climber'
      : status === 'holding'
        ? 'Holding the locked climber while ignoring nearby interference'
        : status === 'reacquiring'
          ? 'Reacquiring the locked climber after a longer interruption'
          : 'Searching for the primary climber';

  return {
    status,
    confidencePct,
    interferenceRiskPct,
    statusLabel,
  };
}

export function createPoseSubjectLockState(): PoseSubjectLockState {
  return {
    signature: null,
    lastAcceptedFrame: null,
    lastAcceptedAt: 0,
    mismatchStreak: 0,
    lostStreak: 0,
  };
}

export function stabilizePoseSubjectFrame(
  nextFrame: PoseFrame | null,
  previousState: PoseSubjectLockState,
): { frame: PoseFrame | null; nextState: PoseSubjectLockState; meta: PoseSubjectLockMeta } {
  const now = Date.now();
  const candidateSignature = buildSubjectSignature(nextFrame);
  const lockable = isLockableFrame(nextFrame, candidateSignature);

  if (!previousState.signature) {
    if (lockable && nextFrame && candidateSignature) {
      return {
        frame: nextFrame,
        nextState: {
          signature: candidateSignature,
          lastAcceptedFrame: nextFrame,
          lastAcceptedAt: now,
          mismatchStreak: 0,
          lostStreak: 0,
        },
        meta: buildMeta('locked', Math.max(68, nextFrame.metrics.frameQualityPct), 6),
      };
    }

    return {
      frame: nextFrame,
      nextState: previousState,
      meta: buildMeta('searching', nextFrame?.metrics.frameQualityPct ?? 0, 0),
    };
  }

  if (lockable && nextFrame && candidateSignature) {
    const comparison = compareSignature(candidateSignature, previousState.signature);

    if (comparison.accepted) {
      return {
        frame: nextFrame,
        nextState: {
          signature: blendSignature(previousState.signature, candidateSignature),
          lastAcceptedFrame: nextFrame,
          lastAcceptedAt: now,
          mismatchStreak: 0,
          lostStreak: 0,
        },
        meta: buildMeta('locked', comparison.confidencePct, comparison.interferenceRiskPct),
      };
    }

    const shouldKeepLock =
      previousState.lastAcceptedFrame &&
      now - previousState.lastAcceptedAt <= LOCK_HOLD_MS &&
      previousState.mismatchStreak < MAX_MISMATCH_STREAK;

    if (shouldKeepLock) {
      return {
        frame: buildHeldFrame(previousState.lastAcceptedFrame),
        nextState: {
          ...previousState,
          mismatchStreak: previousState.mismatchStreak + 1,
        },
        meta: buildMeta('holding', Math.max(32, 100 - comparison.interferenceRiskPct), comparison.interferenceRiskPct),
      };
    }

    const shouldReacquire =
      now - previousState.lastAcceptedAt >= REACQUIRE_MS ||
      previousState.mismatchStreak >= MAX_MISMATCH_STREAK;

    if (shouldReacquire) {
      return {
        frame: nextFrame,
        nextState: {
          signature: candidateSignature,
          lastAcceptedFrame: nextFrame,
          lastAcceptedAt: now,
          mismatchStreak: 0,
          lostStreak: 0,
        },
        meta: buildMeta('reacquiring', Math.max(56, comparison.confidencePct), comparison.interferenceRiskPct),
      };
    }
  }

  if (previousState.lastAcceptedFrame && now - previousState.lastAcceptedAt <= LOCK_HOLD_MS) {
    return {
      frame: buildHeldFrame(previousState.lastAcceptedFrame),
      nextState: {
        ...previousState,
        lostStreak: previousState.lostStreak + 1,
      },
      meta: buildMeta('holding', 34, 24),
    };
  }

  return {
    frame: nextFrame,
    nextState: createPoseSubjectLockState(),
    meta: buildMeta('searching', nextFrame?.metrics.frameQualityPct ?? 0, 0),
  };
}
