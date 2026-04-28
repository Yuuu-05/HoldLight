import { memo, useMemo } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import type { GuidanceLimb, Hold, RoutePlan, WallMap } from '../../../shared/types/climb';
import type { LivePoseState } from '../hooks/useLivePoseTracker';
import {
  POSE_CONNECTIONS,
  type PoseConnection,
  type PoseFrame,
  type PoseJointName,
} from '../services/poseTracker.service';
import { buildPoseTrackerStatus } from '../services/liveGuidanceSpeech.service';

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

const FEATURE_LABELS_EN: Partial<Record<PoseJointName, string>> = {
  head: 'H',
  leftHandContact: 'LH',
  rightHandContact: 'RH',
  leftFootContact: 'LF',
  rightFootContact: 'RF',
};

const FEATURE_LABELS_ZH: Partial<Record<PoseJointName, string>> = {
  head: '头',
  leftHandContact: '左手',
  rightHandContact: '右手',
  leftFootContact: '左脚',
  rightFootContact: '右脚',
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

function SmallCompletedDot({ hold }: { hold: OverlayHold }) {
  const color = holdColorMap[hold.color] ?? holdColorMap.unknown;
  const anchor = getOverlayAnchorPoint(hold);

  return (
    <span
      style={{
        position: 'absolute',
        left: `${anchor.xPct}%`,
        top: `${anchor.yPct}%`,
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

function getOverlayBounds(hold: OverlayHold) {
  if (hold.projectedQuadPct?.length === 4) {
    const xValues = hold.projectedQuadPct.map((point) => point.xPct);
    const yValues = hold.projectedQuadPct.map((point) => point.yPct);
    const leftPct = Math.max(0, Math.min(...xValues));
    const topPct = Math.max(0, Math.min(...yValues));
    const rightPct = Math.min(100, Math.max(...xValues));
    const bottomPct = Math.min(100, Math.max(...yValues));

    return {
      leftPct,
      topPct,
      widthPct: Math.max(0.8, rightPct - leftPct),
      heightPct: Math.max(0.8, bottomPct - topPct),
    };
  }

  const hasBox =
    hold.x1Pct !== undefined &&
    hold.y1Pct !== undefined &&
    hold.x2Pct !== undefined &&
    hold.y2Pct !== undefined;

  if (hasBox) {
    return {
      leftPct: hold.x1Pct!,
      topPct: hold.y1Pct!,
      widthPct: Math.max(0.8, hold.x2Pct! - hold.x1Pct!),
      heightPct: Math.max(0.8, hold.y2Pct! - hold.y1Pct!),
    };
  }

  return {
    leftPct: Math.max(0, hold.xPct - 1.2),
    topPct: Math.max(0, hold.yPct - 1.2),
    widthPct: 2.4,
    heightPct: 2.4,
  };
}

function getOverlayAnchorPoint(hold: OverlayHold) {
  if (hold.projectedQuadPct?.length === 4) {
    const xPct = hold.projectedQuadPct.reduce((sum, point) => sum + point.xPct, 0) / hold.projectedQuadPct.length;
    const yPct = hold.projectedQuadPct.reduce((sum, point) => sum + point.yPct, 0) / hold.projectedQuadPct.length;

    return {
      xPct,
      yPct,
    };
  }

  const hasBox =
    hold.x1Pct !== undefined &&
    hold.y1Pct !== undefined &&
    hold.x2Pct !== undefined &&
    hold.y2Pct !== undefined;

  if (hasBox) {
    return {
      xPct: (hold.x1Pct! + hold.x2Pct!) / 2,
      yPct: (hold.y1Pct! + hold.y2Pct!) / 2,
    };
  }

  return {
    xPct: hold.xPct,
    yPct: hold.yPct,
  };
}

function averageVisibleCorePoints(
  points: Array<{ xPct: number; yPct: number; visibility: number } | undefined>,
) {
  const visiblePoints = points.filter(
    (point): point is { xPct: number; yPct: number; visibility: number } =>
      Boolean(point && point.visibility >= 0.35),
  );

  if (visiblePoints.length === 0) return null;

  return {
    xPct: visiblePoints.reduce((sum, point) => sum + point.xPct, 0) / visiblePoints.length,
    yPct: visiblePoints.reduce((sum, point) => sum + point.yPct, 0) / visiblePoints.length,
    visibility: visiblePoints.reduce((sum, point) => sum + point.visibility, 0) / visiblePoints.length,
  };
}

function getChestPoint(poseFrame: PoseFrame | null) {
  const shoulders = averageVisibleCorePoints([
    poseFrame?.joints.leftShoulder,
    poseFrame?.joints.rightShoulder,
  ]);
  const hips = averageVisibleCorePoints([
    poseFrame?.joints.leftHip,
    poseFrame?.joints.rightHip,
  ]);

  if (shoulders && hips) {
    return {
      xPct: (shoulders.xPct * 0.68) + (hips.xPct * 0.32),
      yPct: (shoulders.yPct * 0.68) + (hips.yPct * 0.32),
    };
  }

  if (shoulders) {
    return {
      xPct: shoulders.xPct,
      yPct: Math.min(100, shoulders.yPct + 6),
    };
  }

  if (hips) {
    return {
      xPct: hips.xPct,
      yPct: Math.max(0, hips.yPct - 12),
    };
  }

  return null;
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
  const color = holdColorMap[hold.color] ?? holdColorMap.unknown;
  const quadPoints = hold.projectedQuadPct?.length === 4
    ? hold.projectedQuadPct.map((point) => `${point.xPct},${point.yPct}`).join(' ')
    : null;
  const bounds = getOverlayBounds(hold);

  if (quadPoints) {
    return (
      <>
        <svg className="assist-live-target-shape-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points={quadPoints}
            fill={dashed ? 'transparent' : `${color}18`}
            stroke={color}
            strokeWidth={0.45}
            strokeDasharray={dashed ? '1.4 1.1' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {label ? (
          <span
            className="assist-live-target-label"
            style={{
              left: `calc(${bounds.leftPct}% + 6px)`,
              top: `calc(${bounds.topPct}% + 6px)`,
              boxShadow: 'none',
              transition: 'none',
            }}
          >
            {label}
          </span>
        ) : null}
      </>
    );
  }

  return (
    <div
      className="assist-live-target"
      style={{
        position: 'absolute',
        left: `${bounds.leftPct}%`,
        top: `${bounds.topPct}%`,
        width: `${bounds.widthPct}%`,
        height: `${bounds.heightPct}%`,
        borderRadius:
          hold.x1Pct !== undefined &&
          hold.y1Pct !== undefined &&
          hold.x2Pct !== undefined &&
          hold.y2Pct !== undefined
            ? '14px'
            : '999px',
        border: `3px ${dashed ? 'dashed' : 'solid'} ${color}`,
        background: dashed ? 'transparent' : `${color}12`,
        boxShadow: 'none',
        transition: 'none',
        transform: 'none',
      }}
    >
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
  const { language } = useLanguage();
  const completedSet = useMemo(() => new Set(completedHoldIds), [completedHoldIds]);

  const completedHolds = useMemo(
    () => routePlan?.holds.filter((hold) => completedSet.has(hold.id)) ?? [],
    [completedSet, routePlan?.holds],
  );

  return (
    <>
      {completedHolds.map((hold) => (
        <SmallCompletedDot key={hold.id} hold={hold} />
      ))}

      {currentHold ? <TargetBox hold={currentHold} label={language === 'zh' ? '目标' : 'target'} /> : null}
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
  const { language } = useLanguage();
  const poseFrame = poseState.poseFrame;
  const activeJointName = useMemo(() => limbToDisplayJointName(activeLimb), [activeLimb]);
  const activeJointPoint = activeJointName ? poseFrame?.joints[activeJointName] : null;
  const currentTargetPoint = useMemo(
    () => (currentHold ? getOverlayAnchorPoint(currentHold) : null),
    [currentHold],
  );
  const chestPoint = useMemo(() => getChestPoint(poseFrame), [poseFrame]);
  const guidanceStartPoint = chestPoint ?? activeJointPoint;
  const featureLabels = language === 'zh' ? FEATURE_LABELS_ZH : FEATURE_LABELS_EN;

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
        {currentHold && guidanceStartPoint ? (
          <line
            className="camera-guidance-link"
            x1={guidanceStartPoint.xPct}
            y1={guidanceStartPoint.yPct}
            x2={currentTargetPoint?.xPct ?? currentHold.xPct}
            y2={currentTargetPoint?.yPct ?? currentHold.yPct}
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
            {featureLabels[jointName] ? (
              <span className="camera-joint-label">{featureLabels[jointName]}</span>
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
  const { language } = useLanguage();
  const trackerStatus = useMemo(() => buildPoseTrackerStatus(poseState, language), [language, poseState]);

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
