import { memo, useMemo } from 'react';
import type { GuidanceLimb, Hold, RoutePlan, WallMap } from '../../../shared/types/climb';
import type { LivePoseState } from '../hooks/useLivePoseTracker';
import {
  POSE_CONNECTIONS,
  type PoseConnection,
  type PoseFrame,
  type PoseJointName,
} from '../services/poseTracker.service';
import { buildPoseTrackerStatusZh } from '../services/liveGuidanceSpeech.service';

type OverlayHold = Hold & {
  projectedQuadPct?: Array<{ xPct: number; yPct: number }>;
};

type OverlayRoutePlan = Omit<RoutePlan, 'holds'> & {
  holds: OverlayHold[];
};

interface LiveGuidanceOverlayProps {
  wallMap?: WallMap | null;
  routePlan?: OverlayRoutePlan | null;
  currentHold?: OverlayHold | null;
  completedHoldIds?: string[];
  poseState: LivePoseState;
  activeLimb?: GuidanceLimb;
}

const holdColorMap: Record<string, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  yellow: '#eab308',
  pink: '#ec4899',
  purple: '#9333ea',
  orange: '#ea580c',
  black: '#0f172a',
  white: '#f8fafc',
  unknown: '#94a3b8',
};

const FEATURE_LABELS: Partial<Record<PoseJointName, string>> = {
  head: 'H',
  leftHandContact: 'LH',
  rightHandContact: 'RH',
  leftFootContact: 'LF',
  rightFootContact: 'RF',
};

const DISPLAYED_JOINTS: PoseJointName[] = [
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftHandContact',
  'rightHandContact',
  'leftFootContact',
  'rightFootContact',
];

function findNextHold(routePlan: OverlayRoutePlan | null | undefined, currentHoldId?: string) {
  if (!routePlan?.holds?.length || !currentHoldId) return null;
  const currentIndex = routePlan.holds.findIndex((hold) => hold.id === currentHoldId);
  if (currentIndex < 0) return null;
  return routePlan.holds[currentIndex + 1] ?? null;
}

function SmallCompletedDot({ hold }: { hold: OverlayHold }) {
  const color = holdColorMap[hold.color] ?? holdColorMap.unknown;

  return (
    <span
      style={{
        position: 'absolute',
        left: `${hold.xPct}%`,
        top: `${hold.yPct}%`,
        width: '8px',
        height: '8px',
        marginLeft: '-4px',
        marginTop: '-4px',
        borderRadius: '999px',
        background: color,
        opacity: 0.42,
      }}
    />
  );
}

function isExtremity(jointName: PoseJointName) {
  return ['leftHandContact', 'rightHandContact', 'leftFootContact', 'rightFootContact'].includes(jointName);
}

function isCoreJoint(jointName: PoseJointName) {
  return ['head', 'leftShoulder', 'rightShoulder', 'leftHip', 'rightHip'].includes(jointName);
}

function isConnectionVisible(connection: PoseConnection, poseFrame: PoseFrame | null) {
  if (!poseFrame) return false;

  const fromPoint = poseFrame.joints[connection.from];
  const toPoint = poseFrame.joints[connection.to];
  return Boolean(fromPoint && toPoint && fromPoint.visibility >= 0.35 && toPoint.visibility >= 0.35);
}

function limbToDisplayJointName(limb: GuidanceLimb | undefined): PoseJointName | null {
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

function TargetBox({
  hold,
  label,
  dashed = false,
}: {
  hold: OverlayHold;
  label?: string;
  dashed?: boolean;
}) {
  const hasBox =
    hold.x1Pct !== undefined &&
    hold.y1Pct !== undefined &&
    hold.x2Pct !== undefined &&
    hold.y2Pct !== undefined;

  const widthPct = hasBox ? Math.max(0.8, hold.x2Pct! - hold.x1Pct!) : 2.4;
  const heightPct = hasBox ? Math.max(0.8, hold.y2Pct! - hold.y1Pct!) : 2.4;
  const color = holdColorMap[hold.color] ?? holdColorMap.unknown;
  const quadPoints = hold.projectedQuadPct?.length === 4
    ? hold.projectedQuadPct.map((point) => `${point.xPct},${point.yPct}`).join(' ')
    : null;

  return (
    <div
      className="assist-live-target"
      style={{
        position: 'absolute',
        left: hasBox ? `${hold.x1Pct}%` : `${hold.xPct}%`,
        top: hasBox ? `${hold.y1Pct}%` : `${hold.yPct}%`,
        width: hasBox ? `${widthPct}%` : '20px',
        height: hasBox ? `${heightPct}%` : '20px',
        marginLeft: hasBox ? undefined : '-10px',
        marginTop: hasBox ? undefined : '-10px',
        borderRadius: hasBox ? '14px' : '999px',
        border: quadPoints ? '0' : `3px ${dashed ? 'dashed' : 'solid'} ${color}`,
        background: quadPoints ? 'transparent' : dashed ? 'transparent' : `${color}12`,
        boxShadow: 'none',
        transition: 'none',
        transform: 'none',
      }}
    >
      {quadPoints ? (
        <svg className="assist-live-target-shape" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points={quadPoints}
            fill={dashed ? 'transparent' : `${color}18`}
            stroke={color}
            strokeWidth={0.45}
            strokeDasharray={dashed ? '1.4 1.1' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      {label ? (
        <span
          className="assist-live-target-label"
          style={{
            boxShadow: 'none',
            transition: 'none',
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

const StaticRouteLayer = memo(function StaticRouteLayer({
  routePlan,
  currentHold,
  completedHoldIds,
}: {
  routePlan?: OverlayRoutePlan | null;
  currentHold?: OverlayHold | null;
  completedHoldIds: string[];
}) {
  const completedSet = useMemo(() => new Set(completedHoldIds), [completedHoldIds]);

  const completedHolds = useMemo(
    () => routePlan?.holds.filter((hold) => completedSet.has(hold.id)) ?? [],
    [completedSet, routePlan?.holds],
  );

  const nextHold = useMemo(
    () => findNextHold(routePlan, currentHold?.id),
    [routePlan, currentHold?.id],
  );

  return (
    <>
      {completedHolds.map((hold) => (
        <SmallCompletedDot key={hold.id} hold={hold} />
      ))}

      {nextHold ? <TargetBox hold={nextHold} label="next" dashed /> : null}
      {currentHold ? <TargetBox hold={currentHold} label={currentHold.label} /> : null}
    </>
  );
});

const DynamicPoseLayer = memo(function DynamicPoseLayer({
  poseState,
  currentHold,
  activeLimb,
}: {
  poseState: LivePoseState;
  currentHold?: OverlayHold | null;
  activeLimb?: GuidanceLimb;
}) {
  const poseFrame = poseState.poseFrame;
  const activeJointName = useMemo(() => limbToDisplayJointName(activeLimb), [activeLimb]);
  const activeJointPoint = activeJointName ? poseFrame?.joints[activeJointName] : null;

  const visibleConnections = useMemo(
    () => POSE_CONNECTIONS.filter((connection) => isConnectionVisible(connection, poseFrame)),
    [poseFrame],
  );

  const visibleJoints = useMemo(() => {
    if (!poseFrame) return [];

    return DISPLAYED_JOINTS.flatMap((jointName) => {
      const point = poseFrame.joints[jointName];
      if (!point || point.visibility < 0.2) return [];
      return [[jointName, point] as const];
    });
  }, [poseFrame]);

  if (!poseFrame) return null;

  return (
    <>
      <svg className="camera-skeleton" viewBox="0 0 100 100" preserveAspectRatio="none">
        {visibleConnections.map((connection) => {
          const fromPoint = poseFrame.joints[connection.from]!;
          const toPoint = poseFrame.joints[connection.to]!;

          return (
            <line
              key={`${connection.from}-${connection.to}`}
              className={`camera-bone camera-bone-${connection.group}`}
              x1={fromPoint.xPct}
              y1={fromPoint.yPct}
              x2={toPoint.xPct}
              y2={toPoint.yPct}
            />
          );
        })}
        {currentHold && activeJointPoint && activeJointPoint.visibility >= 0.35 ? (
          <line
            className="camera-guidance-link"
            x1={activeJointPoint.xPct}
            y1={activeJointPoint.yPct}
            x2={currentHold.xPct}
            y2={currentHold.yPct}
          />
        ) : null}
      </svg>

      {visibleJoints.map(([jointName, point]) => {
        if (!point) return null;

        const jointClasses = [
          'camera-joint',
          poseFrame.metrics.frameQualityPct >= 55 ? 'tracked' : 'limited',
          isExtremity(jointName) ? 'extremity' : '',
          isCoreJoint(jointName) ? 'core' : '',
          jointName === 'head' ? 'head' : '',
          activeJointName === jointName ? 'active' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <span
            key={jointName}
            className={jointClasses}
            style={{ left: `${point.xPct}%`, top: `${point.yPct}%` }}
          >
            {FEATURE_LABELS[jointName] ? (
              <span className="camera-joint-label">{FEATURE_LABELS[jointName]}</span>
            ) : null}
          </span>
        );
      })}
    </>
  );
});

export default function LiveGuidanceOverlay({
  wallMap: _wallMap,
  routePlan,
  currentHold,
  completedHoldIds = [],
  poseState,
  activeLimb,
}: LiveGuidanceOverlayProps) {
  const trackerStatus = useMemo(() => buildPoseTrackerStatusZh(poseState), [poseState]);

  return (
    <div className="assist-live-overlay" aria-hidden="true">
      <div className={`assist-live-tracker-status is-${trackerStatus.tone}`}>
        <strong>{trackerStatus.headline}</strong>
        <span>{trackerStatus.detail}</span>
      </div>
      <StaticRouteLayer
        routePlan={routePlan}
        currentHold={currentHold}
        completedHoldIds={completedHoldIds}
      />
      <DynamicPoseLayer poseState={poseState} currentHold={currentHold} activeLimb={activeLimb} />
    </div>
  );
}
