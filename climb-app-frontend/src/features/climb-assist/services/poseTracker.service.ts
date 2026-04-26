import type { GuidanceLimb } from '../../../shared/types/climb';
import {
  createPoseInstance,
  loadMediapipePoseScript,
  type PoseLandmark,
} from '../../../shared/lib/mediapipePose';

export type PoseJointName =
  | 'head'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftPinky'
  | 'rightPinky'
  | 'leftIndex'
  | 'rightIndex'
  | 'leftThumb'
  | 'rightThumb'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle'
  | 'leftHeel'
  | 'rightHeel'
  | 'leftFootIndex'
  | 'rightFootIndex'
  | 'leftHandContact'
  | 'rightHandContact'
  | 'leftFootContact'
  | 'rightFootContact';

export interface PosePoint {
  xPct: number;
  yPct: number;
  visibility: number;
}

export interface PoseConnection {
  from: PoseJointName;
  to: PoseJointName;
  group: 'head' | 'torso' | 'arm' | 'leg' | 'hand' | 'foot';
}

export interface PoseMetrics {
  trackedJointCount: number;
  visibleJointCount: number;
  visibleLimbCount: number;
  frameQualityPct: number;
  limbCoveragePct: number;
}

export interface PoseFrame {
  timestamp: number;
  joints: Partial<Record<PoseJointName, PosePoint>>;
  metrics: PoseMetrics;
}

export interface PoseTracker {
  estimate: (image: HTMLVideoElement | HTMLCanvasElement) => Promise<PoseFrame | null>;
  dispose: () => void;
}

export interface PoseTrackerRuntimeOptions {
  modelComplexity?: 0 | 1 | 2;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

const LOW_VISIBILITY_THRESHOLD = 0.35;
const CORE_SMOOTHING_ALPHA = 0.6;
const LIMB_SMOOTHING_ALPHA = 0.72;
const CONTACT_SMOOTHING_ALPHA = 0.82;
const FRAME_MISS_DECAY = 0.68;

type RawPoseJointName = Exclude<
  PoseJointName,
  'head' | 'leftHandContact' | 'rightHandContact' | 'leftFootContact' | 'rightFootContact'
>;

const LANDMARK_INDEX: Record<RawPoseJointName, number> = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
};

const FACE_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const HEAD_PRIORITY_INDEXES = [0, 2, 5, 7, 8] as const;

const LIMB_GROUPS: Array<PoseJointName[]> = [
  ['leftShoulder', 'leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow', 'rightWrist'],
  ['leftHip', 'leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee', 'rightAnkle'],
];

export const POSE_CONNECTIONS: PoseConnection[] = [
  { from: 'head', to: 'leftShoulder', group: 'head' },
  { from: 'head', to: 'rightShoulder', group: 'head' },
  { from: 'leftShoulder', to: 'rightShoulder', group: 'torso' },
  { from: 'leftShoulder', to: 'leftHip', group: 'torso' },
  { from: 'rightShoulder', to: 'rightHip', group: 'torso' },
  { from: 'leftHip', to: 'rightHip', group: 'torso' },
  { from: 'leftShoulder', to: 'leftElbow', group: 'arm' },
  { from: 'leftElbow', to: 'leftHandContact', group: 'arm' },
  { from: 'rightShoulder', to: 'rightElbow', group: 'arm' },
  { from: 'rightElbow', to: 'rightHandContact', group: 'arm' },
  { from: 'leftHip', to: 'leftKnee', group: 'leg' },
  { from: 'leftKnee', to: 'leftFootContact', group: 'leg' },
  { from: 'rightHip', to: 'rightKnee', group: 'leg' },
  { from: 'rightKnee', to: 'rightFootContact', group: 'leg' },
];

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function isContactJoint(jointName: PoseJointName) {
  return (
    jointName === 'leftHandContact' ||
    jointName === 'rightHandContact' ||
    jointName === 'leftFootContact' ||
    jointName === 'rightFootContact'
  );
}

function isExtremityJoint(jointName: PoseJointName) {
  return (
    jointName === 'leftWrist' ||
    jointName === 'rightWrist' ||
    jointName === 'leftThumb' ||
    jointName === 'rightThumb' ||
    jointName === 'leftIndex' ||
    jointName === 'rightIndex' ||
    jointName === 'leftPinky' ||
    jointName === 'rightPinky' ||
    jointName === 'leftAnkle' ||
    jointName === 'rightAnkle' ||
    jointName === 'leftHeel' ||
    jointName === 'rightHeel' ||
    jointName === 'leftFootIndex' ||
    jointName === 'rightFootIndex' ||
    isContactJoint(jointName)
  );
}

function getSmoothingAlpha(jointName: PoseJointName) {
  if (isContactJoint(jointName)) return CONTACT_SMOOTHING_ALPHA;
  if (isExtremityJoint(jointName)) return LIMB_SMOOTHING_ALPHA;
  return CORE_SMOOTHING_ALPHA;
}

function smoothPoint(nextPoint: PosePoint, previousPoint?: PosePoint, alpha = CORE_SMOOTHING_ALPHA): PosePoint {
  if (!previousPoint || previousPoint.visibility < LOW_VISIBILITY_THRESHOLD) {
    return nextPoint;
  }

  if (nextPoint.visibility < LOW_VISIBILITY_THRESHOLD) {
    return {
      xPct: previousPoint.xPct,
      yPct: previousPoint.yPct,
      visibility: Number((previousPoint.visibility * FRAME_MISS_DECAY).toFixed(2)),
    };
  }

  return {
    xPct: clampPct(previousPoint.xPct + (nextPoint.xPct - previousPoint.xPct) * alpha),
    yPct: clampPct(previousPoint.yPct + (nextPoint.yPct - previousPoint.yPct) * alpha),
    visibility: Number(Math.max(nextPoint.visibility, previousPoint.visibility * 0.75).toFixed(2)),
  };
}

function blendPoints(
  parts: Array<{ point?: PosePoint; weight: number }>,
  previousPoint?: PosePoint,
  alpha = CONTACT_SMOOTHING_ALPHA,
): PosePoint | null {
  const visibleParts = parts.filter(
    (part): part is { point: PosePoint; weight: number } =>
      Boolean(part.point && part.point.visibility >= LOW_VISIBILITY_THRESHOLD * 0.72),
  );

  if (visibleParts.length === 0) {
    return previousPoint && previousPoint.visibility >= LOW_VISIBILITY_THRESHOLD * 0.75
      ? {
          xPct: previousPoint.xPct,
          yPct: previousPoint.yPct,
          visibility: Number((previousPoint.visibility * FRAME_MISS_DECAY).toFixed(2)),
        }
      : null;
  }

  const totalWeight = visibleParts.reduce((sum, part) => sum + part.weight, 0);
  const xPct =
    visibleParts.reduce((sum, part) => sum + part.point.xPct * part.weight, 0) / Math.max(0.0001, totalWeight);
  const yPct =
    visibleParts.reduce((sum, part) => sum + part.point.yPct * part.weight, 0) / Math.max(0.0001, totalWeight);
  const visibility =
    visibleParts.reduce((sum, part) => sum + part.point.visibility * part.weight, 0) /
    Math.max(0.0001, totalWeight);

  return smoothPoint(
    {
      xPct: clampPct(xPct),
      yPct: clampPct(yPct),
      visibility: Number(Math.max(0, Math.min(1, visibility)).toFixed(2)),
    },
    previousPoint,
    alpha,
  );
}

function buildHandContact(
  side: 'left' | 'right',
  joints: Partial<Record<PoseJointName, PosePoint>>,
  previousPoint?: PosePoint,
) {
  const wrist = joints[side === 'left' ? 'leftWrist' : 'rightWrist'];
  const thumb = joints[side === 'left' ? 'leftThumb' : 'rightThumb'];
  const index = joints[side === 'left' ? 'leftIndex' : 'rightIndex'];
  const pinky = joints[side === 'left' ? 'leftPinky' : 'rightPinky'];

  return blendPoints(
    [
      { point: wrist, weight: 0.22 },
      { point: thumb, weight: 0.14 },
      { point: index, weight: 0.34 },
      { point: pinky, weight: 0.3 },
    ],
    previousPoint,
  );
}

function buildFootContact(
  side: 'left' | 'right',
  joints: Partial<Record<PoseJointName, PosePoint>>,
  previousPoint?: PosePoint,
) {
  const ankle = joints[side === 'left' ? 'leftAnkle' : 'rightAnkle'];
  const heel = joints[side === 'left' ? 'leftHeel' : 'rightHeel'];
  const toe = joints[side === 'left' ? 'leftFootIndex' : 'rightFootIndex'];

  return blendPoints(
    [
      { point: ankle, weight: 0.18 },
      { point: heel, weight: 0.18 },
      { point: toe, weight: 0.64 },
    ],
    previousPoint,
  );
}

function buildMetrics(joints: Partial<Record<PoseJointName, PosePoint>>): PoseMetrics {
  const allPoints = Object.values(joints).filter(Boolean) as PosePoint[];
  const visibleJointCount = allPoints.filter((point) => point.visibility >= LOW_VISIBILITY_THRESHOLD).length;
  const visibleLimbCount = LIMB_GROUPS.filter((group) =>
    group.every((jointName) => (joints[jointName]?.visibility ?? 0) >= LOW_VISIBILITY_THRESHOLD),
  ).length;
  const trackedJointCount = allPoints.length;
  const frameQualityPct = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((visibleJointCount / Math.max(1, trackedJointCount)) * 0.7 + (visibleLimbCount / 4) * 0.3) * 100,
      ),
    ),
  );
  const limbCoveragePct = Math.round((visibleLimbCount / 4) * 100);

  return {
    trackedJointCount,
    visibleJointCount,
    visibleLimbCount,
    frameQualityPct,
    limbCoveragePct,
  };
}

function buildDecayedFrame(previousJoints: Partial<Record<PoseJointName, PosePoint>>) {
  const decayedJoints: PoseFrame['joints'] = {};

  (Object.entries(previousJoints) as Array<[PoseJointName, PosePoint | undefined]>).forEach(([jointName, point]) => {
    if (!point || point.visibility <= 0.12) return;

    decayedJoints[jointName] = {
      xPct: point.xPct,
      yPct: point.yPct,
      visibility: Number((point.visibility * FRAME_MISS_DECAY).toFixed(2)),
    };
  });

  return Object.keys(decayedJoints).length > 0
    ? {
        timestamp: Date.now(),
        joints: decayedJoints,
        metrics: buildMetrics(decayedJoints),
      }
    : null;
}

function buildHeadPoint(landmarks: PoseLandmark[], previousHead?: PosePoint): PosePoint | null {
  const priorityPoints = HEAD_PRIORITY_INDEXES
    .map((index) => landmarks[index])
    .filter((landmark) => landmark && (landmark.visibility ?? 1) >= LOW_VISIBILITY_THRESHOLD);

  const fallbackPoints = FACE_INDEXES
    .map((index) => landmarks[index])
    .filter((landmark) => landmark && (landmark.visibility ?? 1) >= LOW_VISIBILITY_THRESHOLD);

  const sourcePoints = priorityPoints.length > 0 ? priorityPoints : fallbackPoints;
  if (sourcePoints.length === 0) {
    return previousHead && previousHead.visibility >= LOW_VISIBILITY_THRESHOLD * 0.8
      ? {
          xPct: previousHead.xPct,
          yPct: previousHead.yPct,
          visibility: Number((previousHead.visibility * FRAME_MISS_DECAY).toFixed(2)),
        }
      : null;
  }

  const avgX = sourcePoints.reduce((sum, point) => sum + point.x, 0) / sourcePoints.length;
  const avgY = sourcePoints.reduce((sum, point) => sum + point.y, 0) / sourcePoints.length;
  const avgVisibility =
    sourcePoints.reduce((sum, point) => sum + (point.visibility ?? 1), 0) / sourcePoints.length;

  return smoothPoint(
    {
      xPct: clampPct(avgX * 100),
      yPct: clampPct(avgY * 100),
      visibility: Number(Math.max(0, Math.min(1, avgVisibility)).toFixed(2)),
    },
    previousHead,
    CORE_SMOOTHING_ALPHA,
  );
}

function normalizePoseResults(
  landmarks: PoseLandmark[] | undefined,
  previousJoints: Partial<Record<PoseJointName, PosePoint>>,
): PoseFrame | null {
  if (!landmarks || landmarks.length === 0) {
    return buildDecayedFrame(previousJoints);
  }

  const joints: PoseFrame['joints'] = {};
  const headPoint = buildHeadPoint(landmarks, previousJoints.head);
  if (headPoint) {
    joints.head = headPoint;
  }

  (Object.keys(LANDMARK_INDEX) as RawPoseJointName[]).forEach((jointName) => {
    const landmark = landmarks[LANDMARK_INDEX[jointName]];
    if (!landmark) return;

    const nextPoint: PosePoint = {
      xPct: clampPct(landmark.x * 100),
      yPct: clampPct(landmark.y * 100),
      visibility: Number(Math.max(0, Math.min(1, landmark.visibility ?? 0)).toFixed(2)),
    };

    joints[jointName] = smoothPoint(nextPoint, previousJoints[jointName], getSmoothingAlpha(jointName));
  });

  const leftHandContact = buildHandContact('left', joints, previousJoints.leftHandContact);
  if (leftHandContact) {
    joints.leftHandContact = leftHandContact;
  }

  const rightHandContact = buildHandContact('right', joints, previousJoints.rightHandContact);
  if (rightHandContact) {
    joints.rightHandContact = rightHandContact;
  }

  const leftFootContact = buildFootContact('left', joints, previousJoints.leftFootContact);
  if (leftFootContact) {
    joints.leftFootContact = leftFootContact;
  }

  const rightFootContact = buildFootContact('right', joints, previousJoints.rightFootContact);
  if (rightFootContact) {
    joints.rightFootContact = rightFootContact;
  }

  return {
    timestamp: Date.now(),
    joints,
    metrics: buildMetrics(joints),
  };
}

export function limbToPoseJointName(limb: GuidanceLimb | undefined): PoseJointName | null {
  switch (limb) {
    case 'leftHand':
      return 'leftHandContact';
    case 'rightHand':
      return 'rightHandContact';
    case 'leftFoot':
      return 'leftFootContact';
    case 'rightFoot':
      return 'rightFootContact';
    default:
      return null;
  }
}

export async function createPoseTracker(options: PoseTrackerRuntimeOptions = {}): Promise<PoseTracker> {
  const assetBase = await loadMediapipePoseScript();

  let latestFrame: PoseFrame | null = null;
  let previousJoints: Partial<Record<PoseJointName, PosePoint>> = {};
  let disposed = false;
  let inflight = false;
  let pendingResolvers: Array<(frame: PoseFrame | null) => void> = [];

  const resolvePending = (frame: PoseFrame | null) => {
    pendingResolvers.forEach((resolve) => resolve(frame));
    pendingResolvers = [];
  };

  const pose = createPoseInstance(
    (results) => {
      const nextFrame = normalizePoseResults(results.poseLandmarks, previousJoints);
      latestFrame = nextFrame;
      previousJoints = nextFrame?.joints ?? previousJoints;
      inflight = false;
      resolvePending(latestFrame);
    },
    {
      assetBase,
      modelComplexity: options.modelComplexity ?? 1,
      selfieMode: false,
      smoothLandmarks: false,
      enableSegmentation: false,
      minDetectionConfidence: options.minDetectionConfidence ?? 0.58,
      minTrackingConfidence: options.minTrackingConfidence ?? 0.62,
    },
  );

  return {
    estimate: async (image) => {
      if (disposed) return null;

      if ('readyState' in image) {
        if (image.readyState < 2 || image.videoWidth === 0 || image.videoHeight === 0) {
          return latestFrame;
        }
      } else if (image.width === 0 || image.height === 0) {
        return latestFrame;
      }

      if (inflight) return latestFrame;

      inflight = true;

      const nextFrame = new Promise<PoseFrame | null>((resolve) => {
        let settled = false;
        const resolveOnce = (frame: PoseFrame | null) => {
          if (settled) return;
          settled = true;
          resolve(frame);
        };

        pendingResolvers.push(resolveOnce);
        window.setTimeout(() => resolveOnce(latestFrame), 420);
      });

      try {
        await pose.send({ image });
        return nextFrame;
      } catch {
        inflight = false;
        resolvePending(latestFrame);
        return latestFrame;
      }
    },
    dispose: () => {
      disposed = true;
      inflight = false;
      resolvePending(latestFrame);
      previousJoints = {};
      pose.close();
    },
  };
}
