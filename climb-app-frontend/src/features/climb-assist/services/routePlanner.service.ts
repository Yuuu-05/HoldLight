import type {
  Hold,
  HoldColor,
  RouteCandidate,
  RouteFinishType,
  RoutePlan,
  RouteReviewState,
  RouteSemantics,
  RouteStartType,
  WallMap,
} from '../../../shared/types/climb';

interface DifficultyProfile {
  maxHorizontalReach: number;
  maxVerticalGain: number;
  maxVerticalDrop: number;
  idealVerticalGain: number;
  maxStartTraverse: number;
  sidePenalty: number;
  confidenceWeight: number;
  maxSupportRise: number;
  supportLateralWindow: number;
  supportVerticalWindow: number;
  beamWidth: number;
  localFanout: number;
  maxHandMoves: number;
  maxSupportInserts: number;
  minSupportScore: number;
}

interface RouteEvaluation {
  score: number;
  holds: Hold[];
  topY: number;
}

interface HoldMoveGeometry {
  dxPct: number;
  dyPct: number;
  distancePct: number;
}

interface HandPathState {
  handIndices: number[];
  score: number;
  startType: RouteStartType;
}

interface SupportCandidateScore {
  hold: Hold;
  score: number;
}

interface PlannerBands {
  bottomY: number;
  topY: number;
  span: number;
  startBandSize: number;
  finishBandSize: number;
  wallCenterX: number;
}

interface PlannedRouteResult {
  orderedHolds: Hold[];
  supportIds: Set<string>;
}

interface SemanticPlannedRoute extends PlannedRouteResult {
  semantics: RouteSemantics;
}

interface StartConfigurationChoice {
  handIndices: number[];
  score: number;
  startType: RouteStartType;
}

interface RouteQualityMetrics {
  reachabilityScore: number;
  stabilityScore: number;
}

const ROUTE_PLANNER_VERSION = 'semantic-route-planner-v2.0';

const startTypeLabels: Record<RouteStartType, string> = {
  'single-start': 'Single-hand start',
  'dual-hand-start': 'Dual-hand start',
  'match-start': 'Match start',
};

const finishTypeLabels: Record<RouteFinishType, string> = {
  'single-finish': 'Single finish',
  'controlled-finish': 'Controlled finish',
  'match-finish': 'Match finish',
};

const difficultyLabels: Record<string, string> = {
  Beginner: 'The sequence stays conservative with calmer lateral movement, earlier foothold setup, and shorter upward steps.',
  Intermediate: 'The sequence keeps a steady rhythm with balanced side movement, upward progress, and stable transitions.',
  Advanced: 'The sequence allows longer reaches, tighter timing, and more aggressive upward progress while staying on the same colour.',
};

const difficultyProfiles: Record<string, DifficultyProfile> = {
  Beginner: {
    maxHorizontalReach: 18,
    maxVerticalGain: 18,
    maxVerticalDrop: 2,
    idealVerticalGain: 10,
    maxStartTraverse: 22,
    sidePenalty: 0.42,
    confidenceWeight: 6.8,
    maxSupportRise: 13,
    supportLateralWindow: 14,
    supportVerticalWindow: 13,
    beamWidth: 8,
    localFanout: 4,
    maxHandMoves: 7,
    maxSupportInserts: 2,
    minSupportScore: 4.9,
  },
  Intermediate: {
    maxHorizontalReach: 25,
    maxVerticalGain: 24,
    maxVerticalDrop: 3,
    idealVerticalGain: 13,
    maxStartTraverse: 26,
    sidePenalty: 0.34,
    confidenceWeight: 6.4,
    maxSupportRise: 16,
    supportLateralWindow: 16,
    supportVerticalWindow: 16,
    beamWidth: 10,
    localFanout: 4,
    maxHandMoves: 8,
    maxSupportInserts: 3,
    minSupportScore: 4.5,
  },
  Advanced: {
    maxHorizontalReach: 32,
    maxVerticalGain: 30,
    maxVerticalDrop: 4,
    idealVerticalGain: 16,
    maxStartTraverse: 30,
    sidePenalty: 0.28,
    confidenceWeight: 6.0,
    maxSupportRise: 18,
    supportLateralWindow: 18,
    supportVerticalWindow: 18,
    beamWidth: 12,
    localFanout: 5,
    maxHandMoves: 9,
    maxSupportInserts: 3,
    minSupportScore: 4.1,
  },
};

function getDifficultyProfile(difficultyPreference: string) {
  return difficultyProfiles[difficultyPreference] ?? difficultyProfiles.Intermediate;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toPercentScore(value: number) {
  return Math.round(clamp(value, 0, 1) * 100);
}

function buildPlannerBands(holds: Hold[]): PlannerBands {
  const sorted = sortBottomToTop(holds);
  const bottomY = sorted[0]?.yPct ?? 0;
  const topY = sorted[sorted.length - 1]?.yPct ?? 0;
  const span = Math.max(1, bottomY - topY);
  return {
    bottomY,
    topY,
    span,
    startBandSize: getBandSize(span, 0.18, 10, 18),
    finishBandSize: getBandSize(span, 0.16, 8, 16),
    wallCenterX: sorted.reduce((sum, hold) => sum + hold.xPct, 0) / Math.max(1, sorted.length),
  };
}

export function getAvailableRouteColors(wallMap: WallMap): HoldColor[] {
  return Array.from(new Set(wallMap.holds.map((hold) => hold.color))).filter(
    (color) => color !== 'unknown',
  ) as HoldColor[];
}

function sortBottomToTop(holds: Hold[]) {
  return [...holds].sort((left, right) => {
    if (right.yPct !== left.yPct) return right.yPct - left.yPct;
    if (left.confidence !== right.confidence) return right.confidence - left.confidence;
    return left.xPct - right.xPct;
  });
}

function inferStartRegion(holds: Hold[]) {
  const meanX = holds.reduce((sum, hold) => sum + hold.xPct, 0) / Math.max(1, holds.length);
  if (meanX < 33) return 'left' as const;
  if (meanX > 67) return 'right' as const;
  return 'center' as const;
}

function getBandSize(span: number, ratio: number, min: number, max: number) {
  return clamp(span * ratio, min, max);
}

function sizeBonus(hold: Hold) {
  switch (hold.size) {
    case 'l':
      return 2.4;
    case 'm':
      return 1.4;
    default:
      return 0.3;
  }
}

function getWallScale(wallMap: WallMap) {
  const width = Math.max(1, wallMap.width || 100);
  const height = Math.max(1, wallMap.height || 100);
  return {
    xPxPerPct: width / 100,
    yPxPerPct: height / 100,
  };
}

function getMoveGeometry(from: Hold, to: Hold, wallMap: WallMap): HoldMoveGeometry {
  const { xPxPerPct, yPxPerPct } = getWallScale(wallMap);
  const dxPct = to.xPct - from.xPct;
  const dyPct = from.yPct - to.yPct;
  const dxPx = dxPct * xPxPerPct;
  const dyPx = dyPct * yPxPerPct;
  const distancePct = Math.hypot(dxPx, dyPx) / Math.max(xPxPerPct, yPxPerPct);
  return {
    dxPct,
    dyPct,
    distancePct,
  };
}

function isInStartBand(hold: Hold, bottomY: number, startBandSize: number) {
  return hold.yPct >= bottomY - startBandSize;
}

function isInFinishBand(hold: Hold, topY: number, finishBandSize: number) {
  return hold.yPct <= topY + finishBandSize;
}

function getStartPriority(hold: Hold, bottomY: number, startBandSize: number) {
  const heightPenalty = Math.abs(bottomY - hold.yPct) * 0.85;
  const roleBonus = hold.role === 'start' ? 5.5 : hold.role === 'foot' ? 2.2 : 0;
  return hold.confidence * 8 + sizeBonus(hold) + roleBonus - heightPenalty;
}

function buildReachableEdges(
  holds: Hold[],
  profile: DifficultyProfile,
  bottomY: number,
  startBandSize: number,
) {
  const edges = holds.map(() => [] as number[]);

  for (let index = 0; index < holds.length; index += 1) {
    const current = holds[index];
    const currentInStartBand = isInStartBand(current, bottomY, startBandSize);

    for (let nextIndex = index + 1; nextIndex < holds.length; nextIndex += 1) {
      const next = holds[nextIndex];
      const dx = Math.abs(next.xPct - current.xPct);
      const dy = current.yPct - next.yPct;
      const horizontalLimit =
        dy < 4
          ? profile.maxStartTraverse
          : profile.maxHorizontalReach + Math.max(0, dy - profile.idealVerticalGain) * 0.3;

      const reachable =
        dy >= -profile.maxVerticalDrop &&
        dy <= profile.maxVerticalGain &&
        dx <= (currentInStartBand ? profile.maxStartTraverse : horizontalLimit);

      if (reachable) {
        edges[index].push(nextIndex);
      }
    }
  }

  return edges;
}

function computeNodeScore(
  hold: Hold,
  topY: number,
  finishBandSize: number,
  bottomY: number,
  startBandSize: number,
  profile: DifficultyProfile,
) {
  const finishBonus =
    hold.role === 'finish' || isInFinishBand(hold, topY, finishBandSize)
      ? 12
      : 0;
  const startBonus =
    hold.role === 'start' || isInStartBand(hold, bottomY, startBandSize)
      ? 4.5
      : 0;
  const footBonus = hold.role === 'foot' ? 1.2 : 0;

  return hold.confidence * profile.confidenceWeight + sizeBonus(hold) + startBonus + finishBonus + footBonus;
}

function computeEdgeScore(
  current: Hold,
  next: Hold,
  profile: DifficultyProfile,
  topY: number,
  finishBandSize: number,
  wallCenterX: number,
) {
  const dx = Math.abs(next.xPct - current.xPct);
  const dy = current.yPct - next.yPct;
  const upwardReward = dy >= 0 ? dy * 1.75 : -Math.abs(dy) * 6;
  const idealPenalty = Math.abs(dy - profile.idealVerticalGain) * 0.42;
  const horizontalPenalty = dx * profile.sidePenalty;
  const centerPenalty = Math.abs(next.xPct - wallCenterX) * 0.02;
  const finishBonus = isInFinishBand(next, topY, finishBandSize) ? 10 : 0;
  const quietFootBonus = next.role === 'foot' && dy <= profile.idealVerticalGain + 4 ? 2.1 : 0;

  return upwardReward - idealPenalty - horizontalPenalty - centerPenalty + finishBonus + quietFootBonus;
}

function isBetterPath(candidate: RouteEvaluation, currentBest: RouteEvaluation | null) {
  if (!currentBest) return true;
  if (candidate.score !== currentBest.score) return candidate.score > currentBest.score;
  if (candidate.holds.length !== currentBest.holds.length) {
    return candidate.holds.length > currentBest.holds.length;
  }
  return candidate.topY < currentBest.topY;
}

function dedupeRoute(route: Hold[]) {
  const seen = new Set<string>();
  return route.filter((hold) => {
    if (seen.has(hold.id)) return false;
    seen.add(hold.id);
    return true;
  });
}

function buildGreedyFallbackRoute(
  holds: Hold[],
  profile: DifficultyProfile,
  topY: number,
  finishBandSize: number,
  bottomY: number,
  startBandSize: number,
) {
  if (holds.length <= 2) return holds;

  const remaining = [...holds];
  const route: Hold[] = [];
  const wallCenterX = holds.reduce((sum, hold) => sum + hold.xPct, 0) / Math.max(1, holds.length);

  remaining.sort(
    (left, right) =>
      getStartPriority(right, bottomY, startBandSize) - getStartPriority(left, bottomY, startBandSize),
  );

  const firstHold = remaining.shift();
  if (!firstHold) return [];
  route.push(firstHold);

  while (remaining.length > 0) {
    const current = route[route.length - 1];
    const reachable = remaining.filter((candidate) => {
      const dx = Math.abs(candidate.xPct - current.xPct);
      const dy = current.yPct - candidate.yPct;
      const inStartBand = isInStartBand(current, bottomY, startBandSize);
      const horizontalLimit = dy < 4 ? profile.maxStartTraverse : profile.maxHorizontalReach;
      return (
        dy >= -profile.maxVerticalDrop &&
        dy <= profile.maxVerticalGain &&
        dx <= (inStartBand ? profile.maxStartTraverse : horizontalLimit)
      );
    });

    const pool = reachable.length > 0 ? reachable : remaining;
    const next = [...pool].sort((left, right) => {
      const leftScore =
        computeNodeScore(left, topY, finishBandSize, bottomY, startBandSize, profile) +
        computeEdgeScore(current, left, profile, topY, finishBandSize, wallCenterX);
      const rightScore =
        computeNodeScore(right, topY, finishBandSize, bottomY, startBandSize, profile) +
        computeEdgeScore(current, right, profile, topY, finishBandSize, wallCenterX);
      return rightScore - leftScore;
    })[0];

    if (!next) break;

    route.push(next);
    const nextIndex = remaining.findIndex((hold) => hold.id === next.id);
    if (nextIndex >= 0) {
      remaining.splice(nextIndex, 1);
    }

    if (isInFinishBand(next, topY, finishBandSize) && route.length >= 3) {
      break;
    }
  }

  return dedupeRoute(route);
}

function buildLegacySameColorPath(holds: Hold[], difficultyPreference: string) {
  const sorted = sortBottomToTop(holds);
  if (sorted.length <= 2) return sorted;

  const profile = getDifficultyProfile(difficultyPreference);
  const bottomY = sorted[0]?.yPct ?? 0;
  const topY = sorted[sorted.length - 1]?.yPct ?? 0;
  const span = Math.max(1, bottomY - topY);
  const startBandSize = getBandSize(span, 0.18, 10, 18);
  const finishBandSize = getBandSize(span, 0.16, 8, 16);
  const wallCenterX = sorted.reduce((sum, hold) => sum + hold.xPct, 0) / Math.max(1, sorted.length);
  const edges = buildReachableEdges(sorted, profile, bottomY, startBandSize);
  const memo = new Map<number, RouteEvaluation>();

  function dfs(index: number): RouteEvaluation {
    const cached = memo.get(index);
    if (cached) return cached;

    const current = sorted[index];
    const currentScore = computeNodeScore(
      current,
      topY,
      finishBandSize,
      bottomY,
      startBandSize,
      profile,
    );

    let best: RouteEvaluation = {
      score:
        currentScore +
        (isInFinishBand(current, topY, finishBandSize) ? 18 : -Math.max(0, current.yPct - topY) * 0.35),
      holds: [current],
      topY: current.yPct,
    };

    for (const nextIndex of edges[index]) {
      const next = sorted[nextIndex];
      const child = dfs(nextIndex);
      const candidate: RouteEvaluation = {
        score:
          currentScore +
          computeEdgeScore(current, next, profile, topY, finishBandSize, wallCenterX) +
          child.score,
        holds: [current, ...child.holds],
        topY: child.topY,
      };

      if (isBetterPath(candidate, best)) {
        best = candidate;
      }
    }

    memo.set(index, best);
    return best;
  }

  const startIndices = sorted
    .map((hold, index) => ({ hold, index }))
    .filter(({ hold }) => isInStartBand(hold, bottomY, startBandSize))
    .sort(
      (left, right) =>
        getStartPriority(right.hold, bottomY, startBandSize) -
        getStartPriority(left.hold, bottomY, startBandSize),
    )
    .slice(0, Math.min(5, sorted.length))
    .map(({ index }) => index);

  let bestRoute: RouteEvaluation | null = null;

  for (const startIndex of startIndices.length > 0 ? startIndices : [0]) {
    const startHold = sorted[startIndex];
    const candidate = dfs(startIndex);
    const boostedCandidate: RouteEvaluation = {
      ...candidate,
      score: candidate.score + getStartPriority(startHold, bottomY, startBandSize),
    };

    if (isBetterPath(boostedCandidate, bestRoute)) {
      bestRoute = boostedCandidate;
    }
  }

  const dedupedBest = dedupeRoute(bestRoute?.holds ?? []);
  if (dedupedBest.length >= Math.min(3, sorted.length)) {
    return dedupedBest;
  }

  return buildGreedyFallbackRoute(
    sorted,
    profile,
    topY,
    finishBandSize,
    bottomY,
    startBandSize,
  );
}

function assignRouteRoles(route: Hold[]) {
  if (route.length === 0) return [];

  const bottomY = Math.max(...route.map((hold) => hold.yPct));
  const topY = Math.min(...route.map((hold) => hold.yPct));
  const span = Math.max(1, bottomY - topY);
  const startBandSize = getBandSize(span, 0.16, 8, 14);

  return route.map((hold, index) => {
    if (index === 0) {
      return { ...hold, role: 'start' as const };
    }

    if (index === route.length - 1) {
      return { ...hold, role: 'finish' as const };
    }

    if (
      index === 1 &&
      (Math.abs(route[0].yPct - hold.yPct) <= startBandSize || hold.role === 'foot')
    ) {
      return { ...hold, role: 'foot' as const };
    }

    if (hold.role === 'foot' && hold.yPct >= bottomY - span * 0.55) {
      return { ...hold, role: 'foot' as const };
    }

    return { ...hold, role: 'intermediate' as const };
  });
}

function isPrimaryHandHold(hold: Hold, bottomY: number, startBandSize: number) {
  if (hold.role === 'start' || hold.role === 'finish') return true;
  if (hold.role === 'foot') return false;
  if (hold.size === 's' && hold.yPct >= bottomY - startBandSize * 0.6) return false;
  return true;
}

function isFinishGoal(hold: Hold, topY: number, finishBandSize: number) {
  return hold.role === 'finish' || isInFinishBand(hold, topY, finishBandSize);
}

function getStartHoldScore(hold: Hold, bottomY: number, startBandSize: number, wallCenterX: number) {
  const startBonus = hold.role === 'start' ? 7.2 : isInStartBand(hold, bottomY, startBandSize) ? 4.8 : 0;
  const footPenalty = hold.role === 'foot' ? 4.4 : 0;
  const edgePenalty = Math.abs(hold.xPct - wallCenterX) * 0.03;
  const heightPenalty = Math.abs(bottomY - hold.yPct) * 0.58;
  return hold.confidence * 8.2 + sizeBonus(hold) * 1.9 + startBonus - footPenalty - edgePenalty - heightPenalty;
}

function getNearbyStartSupportScore(
  hand: Hold,
  supportPool: Hold[],
  profile: DifficultyProfile,
  bottomY: number,
  startBandSize: number,
) {
  let bestScore = 0;

  for (const support of supportPool) {
    if (support.id === hand.id) continue;
    if (support.yPct < bottomY - Math.max(startBandSize * 1.15, profile.supportVerticalWindow + 1)) continue;
    if (Math.abs(support.xPct - hand.xPct) > profile.supportLateralWindow) continue;

    const verticalOffset = Math.max(0, hand.yPct - support.yPct);
    const lateralOffset = Math.abs(hand.xPct - support.xPct);
    const score =
      support.confidence * 3.8 +
      sizeBonus(support) * 1.4 +
      (support.role === 'foot' ? 2.6 : 1.1) -
      lateralOffset * 0.08 -
      verticalOffset * 0.05;

    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

function isDualHandStartCandidate(
  leftHand: Hold,
  rightHand: Hold,
  bottomY: number,
  startBandSize: number,
  profile: DifficultyProfile,
) {
  if (leftHand.id === rightHand.id) return false;
  if (!isInStartBand(leftHand, bottomY, startBandSize) || !isInStartBand(rightHand, bottomY, startBandSize)) {
    return false;
  }
  if (leftHand.role === 'foot' || rightHand.role === 'foot') return false;

  const lateralGap = Math.abs(rightHand.xPct - leftHand.xPct);
  const heightGap = Math.abs(rightHand.yPct - leftHand.yPct);
  return (
    lateralGap >= 5 &&
    lateralGap <= profile.maxStartTraverse * 0.92 &&
    heightGap <= Math.max(4.5, startBandSize * 0.45)
  );
}

function getDualHandStartScore(
  leftHand: Hold,
  rightHand: Hold,
  supportPool: Hold[],
  profile: DifficultyProfile,
  bottomY: number,
  startBandSize: number,
  wallCenterX: number,
) {
  const idealGap = clamp(profile.maxStartTraverse * 0.45, 7, 14);
  const lateralGap = Math.abs(rightHand.xPct - leftHand.xPct);
  const heightGap = Math.abs(rightHand.yPct - leftHand.yPct);
  const midpointX = (leftHand.xPct + rightHand.xPct) / 2;
  const supportSignal =
    (getNearbyStartSupportScore(leftHand, supportPool, profile, bottomY, startBandSize) +
      getNearbyStartSupportScore(rightHand, supportPool, profile, bottomY, startBandSize)) /
    2;

  return (
    leftHand.confidence * 7.2 +
    rightHand.confidence * 7.2 +
    sizeBonus(leftHand) * 1.6 +
    sizeBonus(rightHand) * 1.6 +
    6.2 +
    Math.min(5.2, supportSignal) -
    Math.abs(lateralGap - idealGap) * 0.24 -
    heightGap * 0.46 -
    Math.abs(midpointX - wallCenterX) * 0.04
  );
}

function buildStartChoices(
  handPool: Hold[],
  supportPool: Hold[],
  profile: DifficultyProfile,
  bottomY: number,
  startBandSize: number,
  wallCenterX: number,
) {
  const maxSeedCount = Math.min(7, handPool.length);
  const choices = new Map<string, StartConfigurationChoice>();

  for (let leftIndex = 0; leftIndex < maxSeedCount; leftIndex += 1) {
    const leftHand = handPool[leftIndex];

    if (!isInStartBand(leftHand, bottomY, startBandSize)) continue;

    const singleScore =
      getStartHoldScore(leftHand, bottomY, startBandSize, wallCenterX) +
      getNearbyStartSupportScore(leftHand, supportPool, profile, bottomY, startBandSize) * 0.42;
    const singleStartType: RouteStartType =
      leftHand.size === 'l' && leftHand.confidence >= 0.62 ? 'match-start' : 'single-start';
    choices.set(`single:${leftIndex}`, {
      handIndices: [leftIndex],
      score: singleScore + (singleStartType === 'match-start' ? 1.8 : 0),
      startType: singleStartType,
    });

    for (let rightIndex = leftIndex + 1; rightIndex < maxSeedCount; rightIndex += 1) {
      const rightHand = handPool[rightIndex];
      if (!isDualHandStartCandidate(leftHand, rightHand, bottomY, startBandSize, profile)) continue;

      choices.set(`pair:${leftIndex}:${rightIndex}`, {
        handIndices: [leftIndex, rightIndex],
        score: getDualHandStartScore(
          leftHand,
          rightHand,
          supportPool,
          profile,
          bottomY,
          startBandSize,
          wallCenterX,
        ),
        startType: 'dual-hand-start',
      });
    }
  }

  return Array.from(choices.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(6, Math.max(1, handPool.length)));
}

function isFeasibleHandTransition(
  previousHand: Hold,
  nextHand: Hold,
  wallMap: WallMap,
  profile: DifficultyProfile,
  topY: number,
  finishBandSize: number,
) {
  if (previousHand.id === nextHand.id) return false;

  const geometry = getMoveGeometry(previousHand, nextHand, wallMap);
  const riseAllowance = isFinishGoal(nextHand, topY, finishBandSize)
    ? profile.maxVerticalGain + 5
    : profile.maxVerticalGain;
  const lateralAllowance =
    profile.maxHorizontalReach + Math.max(0, geometry.dyPct - profile.idealVerticalGain) * 0.32;

  return (
    geometry.dyPct >= -profile.maxVerticalDrop &&
    geometry.dyPct <= riseAllowance &&
    Math.abs(geometry.dxPct) <= lateralAllowance
  );
}

function getSupportCandidateScore(
  support: Hold,
  previousHand: Hold,
  nextHand: Hold,
  wallMap: WallMap,
  profile: DifficultyProfile,
  preferEarlySupport = false,
) {
  if (support.id === previousHand.id || support.id === nextHand.id) return Number.NEGATIVE_INFINITY;

  const midpointX = (previousHand.xPct + nextHand.xPct) / 2;
  const transitionGeometry = getMoveGeometry(previousHand, nextHand, wallMap);
  const supportFromPrevious = getMoveGeometry(previousHand, support, wallMap);
  const supportToTarget = getMoveGeometry(support, nextHand, wallMap);
  const riseFromPrevious = supportFromPrevious.dyPct;
  const dropToTarget = support.yPct - nextHand.yPct;
  const lateralFromMid = Math.abs(support.xPct - midpointX);

  if (riseFromPrevious < -1.25) return Number.NEGATIVE_INFINITY;
  if (riseFromPrevious > profile.maxSupportRise + (preferEarlySupport ? 3 : 0)) return Number.NEGATIVE_INFINITY;
  if (dropToTarget < -1.5) return Number.NEGATIVE_INFINITY;
  if (
    dropToTarget >
    profile.supportVerticalWindow + Math.max(0, transitionGeometry.dyPct) * 0.45
  ) {
    return Number.NEGATIVE_INFINITY;
  }
  if (
    lateralFromMid >
    profile.supportLateralWindow + Math.abs(transitionGeometry.dxPct) * 0.35
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const targetRise = Math.min(
    profile.maxSupportRise * 0.75,
    Math.max(2.5, transitionGeometry.dyPct * 0.6),
  );

  let score = support.confidence * 4.5 + sizeBonus(support) * 1.9;
  if (support.role === 'foot') score += 4.2;
  if (support.yPct > nextHand.yPct) score += 1.1;
  if (preferEarlySupport && support.yPct <= previousHand.yPct + 0.8) score += 1.5;
  score -= lateralFromMid * 0.14;
  score -= Math.abs(riseFromPrevious - targetRise) * 0.1;
  score -= Math.abs(supportToTarget.dxPct) * 0.05;
  return score;
}

function findBestSupportCandidate(
  previousHand: Hold,
  nextHand: Hold,
  supportPool: Hold[],
  usedIds: Set<string>,
  wallMap: WallMap,
  profile: DifficultyProfile,
  preferEarlySupport = false,
): SupportCandidateScore | null {
  let best: SupportCandidateScore | null = null;

  for (const support of supportPool) {
    if (usedIds.has(support.id)) continue;
    const score = getSupportCandidateScore(
      support,
      previousHand,
      nextHand,
      wallMap,
      profile,
      preferEarlySupport,
    );

    if (!Number.isFinite(score)) continue;
    if (!best || score > best.score) {
      best = { hold: support, score };
    }
  }

  return best;
}

function getSupportSignal(
  previousHand: Hold,
  nextHand: Hold,
  supportPool: Hold[],
  wallMap: WallMap,
  profile: DifficultyProfile,
) {
  const usedIds = new Set<string>([previousHand.id, nextHand.id]);
  return findBestSupportCandidate(
    previousHand,
    nextHand,
    supportPool,
    usedIds,
    wallMap,
    profile,
  )?.score ?? 0;
}

function getFinishControlScore(
  previousHand: Hold,
  nextHand: Hold,
  supportPool: Hold[],
  wallMap: WallMap,
  profile: DifficultyProfile,
  topY: number,
  finishBandSize: number,
) {
  if (!isFinishGoal(nextHand, topY, finishBandSize)) return 0;

  const geometry = getMoveGeometry(previousHand, nextHand, wallMap);
  const supportSignal = getSupportSignal(previousHand, nextHand, supportPool, wallMap, profile);

  let score =
    nextHand.confidence * 3.6 +
    sizeBonus(nextHand) * 2.4 +
    Math.min(6, supportSignal) +
    (nextHand.role === 'finish' ? 3.4 : 1.8);

  if (geometry.dyPct <= profile.maxVerticalGain * 0.8) score += 1.6;
  if (geometry.dyPct > profile.maxVerticalGain * 0.92 && supportSignal < profile.minSupportScore + 0.7) {
    score -= 2.8;
  }
  if (nextHand.size === 's') score -= 2.1;

  return score;
}

function computeHandTransitionScore(
  previousHand: Hold,
  nextHand: Hold,
  earlierHand: Hold | null,
  supportPool: Hold[],
  wallMap: WallMap,
  profile: DifficultyProfile,
  topY: number,
  finishBandSize: number,
  bottomY: number,
  startBandSize: number,
) {
  if (!isFeasibleHandTransition(previousHand, nextHand, wallMap, profile, topY, finishBandSize)) {
    return Number.NEGATIVE_INFINITY;
  }

  const geometry = getMoveGeometry(previousHand, nextHand, wallMap);
  const supportSignal = getSupportSignal(previousHand, nextHand, supportPool, wallMap, profile);
  const finishControlScore = getFinishControlScore(
    previousHand,
    nextHand,
    supportPool,
    wallMap,
    profile,
    topY,
    finishBandSize,
  );

  let score =
    computeNodeScore(nextHand, topY, finishBandSize, bottomY, startBandSize, profile) +
    geometry.dyPct * 1.65 -
    Math.abs(geometry.dyPct - profile.idealVerticalGain) * 0.38 -
    Math.abs(geometry.dxPct) * profile.sidePenalty +
    supportSignal * 1.65;

  if (nextHand.role === 'foot' && !isFinishGoal(nextHand, topY, finishBandSize)) {
    score -= 7;
  }

  if (earlierHand) {
    const baseCenterX = (earlierHand.xPct + previousHand.xPct) / 2;
    const previousDirection = Math.sign(previousHand.xPct - earlierHand.xPct);
    const nextDirection = Math.sign(nextHand.xPct - previousHand.xPct);
    const laneSwap = previousDirection !== 0 && nextDirection !== 0 && previousDirection !== nextDirection;

    score -= Math.abs(nextHand.xPct - baseCenterX) * 0.14;

    if (
      Math.abs(geometry.dxPct) > profile.maxHorizontalReach * 0.75 &&
      supportSignal < profile.minSupportScore + 0.6
    ) {
      score -= 7;
    }

    if (laneSwap && supportSignal < profile.minSupportScore) {
      score -= 3;
    }
  }

  if (
    supportSignal < profile.minSupportScore &&
    geometry.dyPct > profile.maxVerticalGain * 0.85
  ) {
    score -= 11;
  }

  if (isFinishGoal(nextHand, topY, finishBandSize)) {
    score += 10 + finishControlScore * 0.9;
    if (finishControlScore < 5.5) {
      score -= 3.5;
    }
  }

  return score;
}

function rankHandPathState(
  state: HandPathState,
  handPool: Hold[],
  bottomY: number,
  topY: number,
  finishBandSize: number,
) {
  const lastIndex = state.handIndices[state.handIndices.length - 1];
  const lastHold = handPool[lastIndex];
  const progress = bottomY - lastHold.yPct;
  const finishBonus = isFinishGoal(lastHold, topY, finishBandSize) ? 18 : 0;
  const startBonus =
    state.startType === 'dual-hand-start'
      ? 4.6
      : state.startType === 'match-start'
        ? 2.4
        : 0;
  return state.score + progress + finishBonus + startBonus;
}

function buildHandPath(holds: Hold[], wallMap: WallMap, difficultyPreference: string) {
  const sorted = sortBottomToTop(holds);
  if (sorted.length <= 2) return sorted;

  const profile = getDifficultyProfile(difficultyPreference);
  const { bottomY, topY, startBandSize, finishBandSize, wallCenterX } = buildPlannerBands(sorted);

  const preferredHandPool = sortBottomToTop(
    sorted.filter((hold) => isPrimaryHandHold(hold, bottomY, startBandSize)),
  );
  const handPool =
    preferredHandPool.length >= Math.min(3, sorted.length) ? preferredHandPool : sorted;
  const handHoldIds = new Set(handPool.map((hold) => hold.id));
  const supportPool = sortBottomToTop(
    sorted.filter((hold) => !handHoldIds.has(hold.id) || hold.role === 'foot'),
  );

  const startChoices = buildStartChoices(
    handPool,
    supportPool,
    profile,
    bottomY,
    startBandSize,
    wallCenterX,
  );

  let states: HandPathState[] = (
    startChoices.length > 0
      ? startChoices
      : [{ handIndices: [0], score: 0, startType: 'single-start' as const }]
  ).map(({ handIndices, score, startType }) => ({
    handIndices: [...handIndices],
    score,
    startType,
  }));
  const finalists: HandPathState[] = [];

  for (let depth = 1; depth < Math.min(profile.maxHandMoves, handPool.length); depth += 1) {
    const expandedStates: HandPathState[] = [];

    for (const state of states) {
      const lastIndex = state.handIndices[state.handIndices.length - 1];
      const lastHold = handPool[lastIndex];
      const previousIndex =
        state.handIndices.length > 1
          ? state.handIndices[state.handIndices.length - 2]
          : null;
      const previousHand = previousIndex === null ? null : handPool[previousIndex];

      if (state.handIndices.length >= 3 && isFinishGoal(lastHold, topY, finishBandSize)) {
        finalists.push(state);
      }

      const nextStates = handPool
        .slice(lastIndex + 1)
        .map((nextHold, offset) => {
          const nextIndex = lastIndex + 1 + offset;
          const transitionScore = computeHandTransitionScore(
            lastHold,
            nextHold,
            previousHand,
            supportPool,
            wallMap,
            profile,
            topY,
            finishBandSize,
            bottomY,
            startBandSize,
          );

          if (!Number.isFinite(transitionScore)) {
            return null;
          }

          return {
            handIndices: [...state.handIndices, nextIndex],
            score: state.score + transitionScore - state.handIndices.length * 0.15,
            startType: state.startType,
          } satisfies HandPathState;
        })
        .filter((candidate): candidate is HandPathState => Boolean(candidate))
        .sort((left, right) => right.score - left.score)
        .slice(0, profile.localFanout);

      expandedStates.push(...nextStates);
    }

    if (expandedStates.length === 0) {
      break;
    }

    const dedupedStates = new Map<string, HandPathState>();
    for (const state of expandedStates.sort((left, right) => right.score - left.score)) {
      const lastIndex = state.handIndices[state.handIndices.length - 1];
      const previousIndex =
        state.handIndices.length > 1
          ? state.handIndices[state.handIndices.length - 2]
          : -1;
      const key = `${previousIndex}:${lastIndex}`;
      const existing = dedupedStates.get(key);
      if (!existing || state.score > existing.score) {
        dedupedStates.set(key, state);
      }
    }

    states = Array.from(dedupedStates.values())
      .sort(
        (left, right) =>
          rankHandPathState(right, handPool, bottomY, topY, finishBandSize) -
          rankHandPathState(left, handPool, bottomY, topY, finishBandSize),
      )
      .slice(0, profile.beamWidth);
  }

  const candidateStates = finalists.length > 0 ? finalists : states;
  const bestState = [...candidateStates].sort(
    (left, right) =>
      rankHandPathState(right, handPool, bottomY, topY, finishBandSize) -
      rankHandPathState(left, handPool, bottomY, topY, finishBandSize),
  )[0];

  if (!bestState) return null;

  let handPath = dedupeRoute(bestState.handIndices.map((index) => handPool[index]));
  const lastHold = handPath[handPath.length - 1];

  if (!isFinishGoal(lastHold, topY, finishBandSize)) {
    const currentLastIndex = bestState.handIndices[bestState.handIndices.length - 1];
    const currentPreviousIndex =
      bestState.handIndices.length > 1
        ? bestState.handIndices[bestState.handIndices.length - 2]
        : null;
    const previousHand =
      currentPreviousIndex === null ? null : handPool[currentPreviousIndex];

    const finishExtension = handPool
      .slice(currentLastIndex + 1)
      .filter((hold) => isFinishGoal(hold, topY, finishBandSize))
      .map((hold) => ({
        hold,
        score: computeHandTransitionScore(
          lastHold,
          hold,
          previousHand,
          supportPool,
          wallMap,
          profile,
          topY,
          finishBandSize,
          bottomY,
          startBandSize,
        ),
      }))
      .filter((candidate) => Number.isFinite(candidate.score))
      .sort((left, right) => right.score - left.score)[0];

    if (finishExtension) {
      handPath = [...handPath, finishExtension.hold];
    }
  }

  return handPath.length >= 2 ? handPath : null;
}

function shouldInsertSupport(
  previousHand: Hold,
  nextHand: Hold,
  supportScore: number,
  wallMap: WallMap,
  profile: DifficultyProfile,
) {
  if (supportScore < profile.minSupportScore) return false;

  const geometry = getMoveGeometry(previousHand, nextHand, wallMap);
  const isHardVerticalMove = geometry.dyPct > profile.idealVerticalGain * 0.95;
  const isHardLateralMove = Math.abs(geometry.dxPct) > profile.maxHorizontalReach * 0.7;
  const isLongMove = geometry.distancePct > profile.maxStartTraverse * 0.72;

  if (
    nextHand.role === 'finish' &&
    !isHardVerticalMove &&
    !isHardLateralMove &&
    supportScore < profile.minSupportScore + 1.1
  ) {
    return false;
  }

  return isHardVerticalMove || isHardLateralMove || isLongMove;
}

function buildSupportAwareRoute(
  handPath: Hold[],
  allHolds: Hold[],
  wallMap: WallMap,
  difficultyPreference: string,
): PlannedRouteResult | null {
  if (handPath.length === 0) return null;

  const profile = getDifficultyProfile(difficultyPreference);
  const handPathIds = new Set(handPath.map((hold) => hold.id));
  const supportPool = sortBottomToTop(
    allHolds.filter((hold) => !handPathIds.has(hold.id) || hold.role === 'foot'),
  );
  const route: Hold[] = [handPath[0]];
  const supportIds = new Set<string>();
  const usedIds = new Set<string>([handPath[0].id]);
  let remainingSupportBudget = Math.min(
    profile.maxSupportInserts,
    Math.max(1, handPath.length - 2),
  );

  if (handPath.length > 1 && remainingSupportBudget > 0) {
    const initialSupport = findBestSupportCandidate(
      handPath[0],
      handPath[1],
      supportPool,
      usedIds,
      wallMap,
      profile,
      true,
    );

    if (initialSupport && initialSupport.score >= profile.minSupportScore + 0.35) {
      route.push(initialSupport.hold);
      supportIds.add(initialSupport.hold.id);
      usedIds.add(initialSupport.hold.id);
      remainingSupportBudget -= 1;
    }
  }

  for (let index = 1; index < handPath.length; index += 1) {
    const previousHand = handPath[index - 1];
    const nextHand = handPath[index];

    if (remainingSupportBudget > 0) {
      const transitionSupport = findBestSupportCandidate(
        previousHand,
        nextHand,
        supportPool,
        usedIds,
        wallMap,
        profile,
      );

      const lastRouteHold = route[route.length - 1];
      if (
        transitionSupport &&
        !supportIds.has(lastRouteHold.id) &&
        shouldInsertSupport(previousHand, nextHand, transitionSupport.score, wallMap, profile)
      ) {
        route.push(transitionSupport.hold);
        supportIds.add(transitionSupport.hold.id);
        usedIds.add(transitionSupport.hold.id);
        remainingSupportBudget -= 1;
      }
    }

    route.push(nextHand);
    usedIds.add(nextHand.id);
  }

  return {
    orderedHolds: dedupeRoute(route),
    supportIds,
  };
}

function applyPlannedRouteRoles(route: Hold[], supportIds: Set<string>) {
  if (route.length === 0) return [];

  const bottomY = Math.max(...route.map((hold) => hold.yPct));
  const topY = Math.min(...route.map((hold) => hold.yPct));
  const span = Math.max(1, bottomY - topY);

  return route.map((hold, index) => {
    if (index === 0) {
      return { ...hold, role: 'start' as const };
    }

    if (index === route.length - 1) {
      return { ...hold, role: 'finish' as const };
    }

    if (supportIds.has(hold.id)) {
      return { ...hold, role: 'foot' as const };
    }

    if (hold.role === 'foot' && hold.yPct >= bottomY - span * 0.55) {
      return { ...hold, role: 'foot' as const };
    }

    return { ...hold, role: 'intermediate' as const };
  });
}

function getRouteHandHolds(route: Hold[], supportIds: Set<string>) {
  const handHolds = route.filter((hold) => !supportIds.has(hold.id) && hold.role !== 'foot');
  return handHolds.length > 0 ? handHolds : route.filter((hold) => hold.role !== 'foot');
}

function classifyRouteStartType(
  route: Hold[],
  supportIds: Set<string>,
  profile: DifficultyProfile,
  bands: PlannerBands,
) {
  const handHolds = getRouteHandHolds(route, supportIds);
  const first = handHolds[0] ?? null;
  const second = handHolds[1] ?? null;
  const lowSupports = route.filter(
    (hold) => (supportIds.has(hold.id) || hold.role === 'foot') && hold.yPct >= bands.bottomY - bands.startBandSize * 1.1,
  );

  if (!first) return 'single-start' as const;
  if (second) {
    const lateralGap = Math.abs(second.xPct - first.xPct);
    const heightGap = Math.abs(second.yPct - first.yPct);

    if (
      lateralGap <= 6 &&
      heightGap <= Math.max(4.5, bands.startBandSize * 0.55) &&
      (first.size === 'l' || second.size === 'l')
    ) {
      return 'match-start' as const;
    }

    if (
      lateralGap >= 5 &&
      lateralGap <= profile.maxStartTraverse * 0.92 &&
      heightGap <= Math.max(4.5, bands.startBandSize * 0.42)
    ) {
      return 'dual-hand-start' as const;
    }
  }

  if (first.size === 'l' && lowSupports.length > 0) {
    return 'match-start' as const;
  }

  return 'single-start' as const;
}

function classifyRouteFinishType(
  route: Hold[],
  supportIds: Set<string>,
  bands: PlannerBands,
) {
  const handHolds = getRouteHandHolds(route, supportIds);
  const last = handHolds[handHolds.length - 1] ?? null;
  const previous = handHolds.length > 1 ? handHolds[handHolds.length - 2] : null;
  const finishSupports = route.filter(
    (hold) =>
      (supportIds.has(hold.id) || hold.role === 'foot') &&
      last &&
      hold.yPct >= last.yPct &&
      hold.yPct <= last.yPct + bands.finishBandSize * 1.4,
  );

  if (!last) return 'single-finish' as const;

  if (previous) {
    const lateralGap = Math.abs(last.xPct - previous.xPct);
    const heightGap = Math.abs(last.yPct - previous.yPct);
    if (
      lateralGap <= 8 &&
      heightGap <= Math.max(4.5, bands.finishBandSize * 0.42) &&
      (last.size === 'l' || previous.size === 'l')
    ) {
      return 'match-finish' as const;
    }
  }

  if (finishSupports.length > 0 || (last.confidence >= 0.68 && last.size !== 's')) {
    return 'controlled-finish' as const;
  }

  return 'single-finish' as const;
}

function computeRouteQualityMetrics(
  route: Hold[],
  supportIds: Set<string>,
  wallMap: WallMap,
  profile: DifficultyProfile,
  startType: RouteStartType,
  finishType: RouteFinishType,
): RouteQualityMetrics {
  if (route.length <= 1) {
    return {
      reachabilityScore: 70,
      stabilityScore: 70,
    };
  }

  let reachabilityTotal = 0;
  let stabilityTotal = 0;

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    const geometry = getMoveGeometry(previous, current, wallMap);
    const horizontalLimit = current.role === 'foot' ? profile.supportLateralWindow : profile.maxHorizontalReach;
    const verticalLimit = current.role === 'foot' ? profile.maxSupportRise : profile.maxVerticalGain;
    const horizontalRatio = Math.min(1.35, Math.abs(geometry.dxPct) / Math.max(1, horizontalLimit));
    const verticalRatio = Math.min(1.35, Math.max(0, geometry.dyPct) / Math.max(1, verticalLimit));
    const dropPenalty =
      geometry.dyPct < -0.75
        ? Math.min(1, Math.abs(geometry.dyPct) / Math.max(1, profile.maxVerticalDrop + 1)) * 0.72
        : 0;

    const reachabilitySegment = clamp(1.12 - horizontalRatio * 0.33 - verticalRatio * 0.26 - dropPenalty, 0, 1);
    const stabilitySegment = clamp(
      0.98 -
        horizontalRatio * 0.23 -
        verticalRatio * 0.18 +
        (supportIds.has(current.id) || current.role === 'foot' ? 0.24 : 0) +
        (current.role === 'finish' ? 0.08 : 0),
      0,
      1,
    );

    reachabilityTotal += reachabilitySegment;
    stabilityTotal += stabilitySegment;
  }

  const averageReachability = reachabilityTotal / Math.max(1, route.length - 1);
  const averageStability = stabilityTotal / Math.max(1, route.length - 1);
  const stabilityBoost =
    (startType === 'dual-hand-start' ? 0.08 : startType === 'match-start' ? 0.05 : 0) +
    (finishType === 'match-finish' ? 0.09 : finishType === 'controlled-finish' ? 0.07 : 0) +
    Math.min(0.08, supportIds.size * 0.025);

  return {
    reachabilityScore: toPercentScore(averageReachability),
    stabilityScore: toPercentScore(averageStability + stabilityBoost),
  };
}

function buildRouteSemantics(
  route: Hold[],
  supportIds: Set<string>,
  wallMap: WallMap,
  difficultyPreference: string,
): RouteSemantics {
  if (route.length === 0) {
    return {
      plannerVersion: ROUTE_PLANNER_VERSION,
      feedbackReady: true,
      reviewState: 'review-recommended',
      startType: 'single-start',
      startLabel: startTypeLabels['single-start'],
      finishType: 'single-finish',
      finishLabel: finishTypeLabels['single-finish'],
      startHoldIds: [],
      finishHoldIds: [],
      supportHoldIds: [],
      reachabilityScore: 0,
      stabilityScore: 0,
      reviewSummary: 'No sequenced holds were available for a stable route review.',
      setterNotes: ['No usable same-colour route could be assembled from the current wall scan.'],
      reviewHints: ['Retake the scan or manually review the detected holds before trusting this route.'],
    };
  }

  const profile = getDifficultyProfile(difficultyPreference);
  const bands = buildPlannerBands(route);
  const handHolds = getRouteHandHolds(route, supportIds);
  const startType = classifyRouteStartType(route, supportIds, profile, bands);
  const finishType = classifyRouteFinishType(route, supportIds, bands);
  const startHoldIds = handHolds.slice(0, Math.min(2, handHolds.length)).map((hold) => hold.id);
  const finishHoldIds = handHolds.slice(-Math.min(2, handHolds.length)).map((hold) => hold.id);
  const supportHoldIds = route.filter((hold) => supportIds.has(hold.id) || hold.role === 'foot').map((hold) => hold.id);
  const metrics = computeRouteQualityMetrics(route, supportIds, wallMap, profile, startType, finishType);
  const setterNotes = [
    `${startTypeLabels[startType]} inferred from ${Math.max(1, startHoldIds.length)} low handhold${startHoldIds.length === 1 ? '' : 's'}.`,
    `${finishTypeLabels[finishType]} selected from the top ${Math.max(1, finishHoldIds.length)} handhold${finishHoldIds.length === 1 ? '' : 's'}.`,
    supportHoldIds.length > 0
      ? `${supportHoldIds.length} support hold${supportHoldIds.length === 1 ? '' : 's'} inserted to calm long or unstable moves.`
      : 'No extra support holds were required for the final sequence.',
  ];
  const reviewHints: string[] = [];

  if (startType === 'single-start') {
    reviewHints.push('Check the start if the wall has a clearer two-hand start.');
  }
  if (finishType === 'single-finish') {
    reviewHints.push('Check the finish if a controlled two-hand finish would be safer.');
  }
  if (metrics.reachabilityScore < 68) {
    reviewHints.push('One move may be a stretch, so check the route before guiding.');
  }
  if (metrics.stabilityScore < 70) {
    reviewHints.push('Some large moves have limited foothold support.');
  }

  const reviewState: RouteReviewState =
    reviewHints.length > 0 ? 'review-recommended' : 'auto-approved';
  const reviewSummary =
    reviewState === 'review-recommended'
      ? `Route review recommended. ${startTypeLabels[startType]}, ${finishTypeLabels[finishType]}, ${metrics.reachabilityScore}% reach, ${metrics.stabilityScore}% stability.`
      : `Route checked. ${startTypeLabels[startType]}, ${finishTypeLabels[finishType]}, ${metrics.reachabilityScore}% reach, ${metrics.stabilityScore}% stability.`;

  return {
    plannerVersion: ROUTE_PLANNER_VERSION,
    feedbackReady: true,
    reviewState,
    startType,
    startLabel: startTypeLabels[startType],
    finishType,
    finishLabel: finishTypeLabels[finishType],
    startHoldIds,
    finishHoldIds,
    supportHoldIds,
    reachabilityScore: metrics.reachabilityScore,
    stabilityScore: metrics.stabilityScore,
    reviewSummary,
    setterNotes,
    reviewHints,
  };
}

function buildSameColorPlannedRoute(
  wallMap: WallMap,
  holds: Hold[],
  difficultyPreference: string,
): SemanticPlannedRoute {
  const sorted = sortBottomToTop(holds);
  const minimumRouteLength = Math.min(3, sorted.length);
  const explicitFinishHold = sorted.find((hold) => hold.role === 'finish') ?? null;
  const legacyFallbackRoute = assignRouteRoles(buildLegacySameColorPath(sorted, difficultyPreference));
  const legacySupportIds = new Set<string>(
    legacyFallbackRoute.filter((hold) => hold.role === 'foot').map((hold) => hold.id),
  );

  if (sorted.length <= 2) {
    const orderedHolds = assignRouteRoles(sorted);
    const supportIds = new Set<string>(orderedHolds.filter((hold) => hold.role === 'foot').map((hold) => hold.id));
    return {
      orderedHolds,
      supportIds,
      semantics: buildRouteSemantics(orderedHolds, supportIds, wallMap, difficultyPreference),
    };
  }

  try {
    const handPath = buildHandPath(sorted, wallMap, difficultyPreference);
    if (handPath && handPath.length >= minimumRouteLength) {
      const supportAwareRoute = buildSupportAwareRoute(
        handPath,
        sorted,
        wallMap,
        difficultyPreference,
      );

      if (
        supportAwareRoute &&
        supportAwareRoute.orderedHolds.length >= minimumRouteLength
      ) {
        const plannedRoute = applyPlannedRouteRoles(
          supportAwareRoute.orderedHolds,
          supportAwareRoute.supportIds,
        );

        const reachesFinish = explicitFinishHold
          ? plannedRoute[plannedRoute.length - 1]?.id === explicitFinishHold.id
          : isInFinishBand(
              plannedRoute[plannedRoute.length - 1],
              Math.min(...sorted.map((hold) => hold.yPct)),
              getBandSize(Math.max(1, sorted[0].yPct - sorted[sorted.length - 1].yPct), 0.16, 8, 16),
            );

        if (reachesFinish) {
          return {
            orderedHolds: plannedRoute,
            supportIds: supportAwareRoute.supportIds,
            semantics: buildRouteSemantics(
              plannedRoute,
              supportAwareRoute.supportIds,
              wallMap,
              difficultyPreference,
            ),
          };
        }
      }
    }
  } catch {
    return {
      orderedHolds: legacyFallbackRoute,
      supportIds: legacySupportIds,
      semantics: buildRouteSemantics(legacyFallbackRoute, legacySupportIds, wallMap, difficultyPreference),
    };
  }

  return {
    orderedHolds: legacyFallbackRoute,
    supportIds: legacySupportIds,
    semantics: buildRouteSemantics(legacyFallbackRoute, legacySupportIds, wallMap, difficultyPreference),
  };
}

function createRouteSelectionHash(holdIds: string[]) {
  const seed = holdIds.slice().sort().join('|');
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function mergeMissingSelectedHolds(orderedHolds: Hold[], selectedHolds: Hold[]) {
  const routeIds = new Set(orderedHolds.map((hold) => hold.id));
  const mergedRoute = [...orderedHolds];
  const missingHolds = sortBottomToTop(selectedHolds.filter((hold) => !routeIds.has(hold.id)));

  for (const hold of missingHolds) {
    const insertIndex = mergedRoute.findIndex((existing) => existing.yPct < hold.yPct);
    if (insertIndex === -1) {
      mergedRoute.push(hold);
    } else {
      mergedRoute.splice(insertIndex, 0, hold);
    }
  }

  return dedupeRoute(mergedRoute);
}

function inferEditedSupportIds(route: Hold[], baseSupportIds: Set<string>) {
  const supportIds = new Set<string>(baseSupportIds);
  if (route.length === 0) return supportIds;

  const bottomY = Math.max(...route.map((hold) => hold.yPct));
  const topY = Math.min(...route.map((hold) => hold.yPct));
  const span = Math.max(1, bottomY - topY);

  route.forEach((hold, index) => {
    if (index === 0 || index === route.length - 1) return;
    if (supportIds.has(hold.id)) return;

    const lowBand = hold.yPct >= bottomY - span * 0.56;
    const compactLowSupport = hold.size === 's' && hold.yPct >= bottomY - span * 0.48;

    if (hold.role === 'foot' || compactLowSupport || (lowBand && hold.size !== 'l')) {
      supportIds.add(hold.id);
    }
  });

  return supportIds;
}

export function buildEditableRoutePlan(
  wallMap: WallMap,
  color: HoldColor,
  selectedHoldIds: string[],
  difficultyPreference: string,
): RoutePlan {
  const normalizedHoldIds = Array.from(new Set(selectedHoldIds));
  const selectedIdSet = new Set(normalizedHoldIds);
  const selectedColorHolds = wallMap.holds.filter(
    (hold) => hold.color === color && selectedIdSet.has(hold.id),
  );
  const selectionHash = createRouteSelectionHash(normalizedHoldIds);

  if (selectedColorHolds.length === 0) {
    const semantics = buildRouteSemantics([], new Set<string>(), wallMap, difficultyPreference);
    return {
      id: `route_${wallMap.id}_${color}_${difficultyPreference.toLowerCase()}_custom_${selectionHash}`,
      scanId: wallMap.id,
      color,
      difficultyPreference,
      holdIds: [],
      holds: [],
      summary: 'No route selected yet. Select at least two same-colour holds to continue.',
      estimatedMoves: 0,
      semantics: {
        ...semantics,
        reviewSummary: 'No holds selected yet. Guidance cannot start until the route has at least two holds.',
        setterNotes: ['Route correction is active, but no holds are selected yet.'],
      },
    };
  }

  const plannedRoute = buildSameColorPlannedRoute(wallMap, selectedColorHolds, difficultyPreference);
  const mergedOrderedHolds = mergeMissingSelectedHolds(plannedRoute.orderedHolds, selectedColorHolds);
  const mergedSupportIds = inferEditedSupportIds(mergedOrderedHolds, plannedRoute.supportIds);
  const editedRoute = applyPlannedRouteRoles(mergedOrderedHolds, mergedSupportIds);
  const semantics = buildRouteSemantics(editedRoute, mergedSupportIds, wallMap, difficultyPreference);
  const reviewHints =
    semantics.reviewHints.length > 0
      ? semantics.reviewHints
      : ['Tap a same-colour hold to add or remove it from the route.'];

  return {
    id: `route_${wallMap.id}_${color}_${difficultyPreference.toLowerCase()}_custom_${selectionHash}`,
    scanId: wallMap.id,
    color,
    difficultyPreference,
    holdIds: editedRoute.map((hold) => hold.id),
    holds: editedRoute,
    summary:
      `Custom ${color.toUpperCase()} route. ${editedRoute.length} selected holds are ready for guidance. ` +
      `Start: ${semantics.startLabel}. Finish: ${semantics.finishLabel}.`,
    estimatedMoves: Math.max(0, editedRoute.length - 1),
    semantics: {
      ...semantics,
      reviewState: 'review-recommended',
      reviewSummary:
        `Custom route active. ${semantics.reviewSummary} Guidance will follow your selected holds.`,
      setterNotes: [
        `Selected ${selectedColorHolds.length} same-colour hold${selectedColorHolds.length === 1 ? '' : 's'} for this route.`,
        ...semantics.setterNotes,
      ],
      reviewHints,
    },
  };
}

function buildCandidateSummary(color: HoldColor, route: Hold[], semantics: RouteSemantics) {
  const startRegion = inferStartRegion(route);
  const bottomY = Math.max(...route.map((hold) => hold.yPct));
  const topY = Math.min(...route.map((hold) => hold.yPct));
  const verticalSpan = Math.round(Math.max(0, bottomY - topY));

  return {
    startRegion,
    verticalSpan,
    summary:
      `${color.toUpperCase()} route. ${semantics.startLabel}, ${semantics.finishLabel}, ` +
      `${route.length} sequenced holds, ${verticalSpan}% vertical span, ${startRegion} start lane, ` +
      `${semantics.reachabilityScore}% reachability, ${semantics.stabilityScore}% stability` +
      `${semantics.reviewState === 'review-recommended' ? ', review recommended.' : '.'}`,
  };
}

function buildColorCandidate(wallMap: WallMap, color: HoldColor) {
  const colorHolds = wallMap.holds.filter((hold) => hold.color === color);
  const plannedRoute = buildSameColorPlannedRoute(wallMap, colorHolds, 'Intermediate');
  const route = plannedRoute.orderedHolds;

  if (route.length === 0) {
    return null;
  }

  const averageConfidence = Number(
    (
      route.reduce((sum, hold) => sum + hold.confidence, 0) /
      Math.max(1, route.length)
    ).toFixed(2),
  );
  const candidateSummary = buildCandidateSummary(color, route, plannedRoute.semantics);

  return {
    id: `same-colour-${wallMap.id}-${color}`,
    color,
    holdIds: route.map((hold) => hold.id),
    confidence: averageConfidence,
    estimatedMoves: Math.max(0, route.length - 1),
    startRegion: candidateSummary.startRegion,
    summary: candidateSummary.summary,
    semantics: plannedRoute.semantics,
  } satisfies RouteCandidate;
}

export function getAvailableRouteCandidates(wallMap: WallMap): RouteCandidate[] {
  return getAvailableRouteColors(wallMap)
    .flatMap((color) => {
      const candidate = buildColorCandidate(wallMap, color);
      return candidate && candidate.holdIds.length > 1 ? [candidate] : [];
    })
    .sort((left, right) => {
      if (left.confidence !== right.confidence) return right.confidence - left.confidence;
      if (left.holdIds.length !== right.holdIds.length) return right.holdIds.length - left.holdIds.length;
      return left.color.localeCompare(right.color);
    });
}

export function buildRoutePlan(
  wallMap: WallMap,
  selection: HoldColor | RouteCandidate,
  difficultyPreference: string,
): RoutePlan {
  const routeCandidate =
    typeof selection === 'string'
      ? getAvailableRouteCandidates(wallMap).find((candidate) => candidate.color === selection)
      : selection;
  const color = routeCandidate?.color ?? (typeof selection === 'string' ? selection : selection.color);

  const sameColorHolds = wallMap.holds.filter((hold) => hold.color === color);
  const plannedRoute = buildSameColorPlannedRoute(wallMap, sameColorHolds, difficultyPreference);
  const orderedRoute = plannedRoute.orderedHolds;
  const semantics = plannedRoute.semantics;
  const confidence = Number(
    (
      orderedRoute.reduce((sum, hold) => sum + hold.confidence, 0) /
      Math.max(1, orderedRoute.length)
    ).toFixed(2),
  );
  const bottomY = orderedRoute.length > 0 ? Math.max(...orderedRoute.map((hold) => hold.yPct)) : 0;
  const topY = orderedRoute.length > 0 ? Math.min(...orderedRoute.map((hold) => hold.yPct)) : 0;
  const verticalSpan = Math.round(Math.max(0, bottomY - topY));
  const summary =
    routeCandidate?.summary ??
    `${color.toUpperCase()} route with ${orderedRoute.length} linked holds.`;

  return {
    id: `route_${wallMap.id}_${color}_${difficultyPreference.toLowerCase()}`,
    scanId: wallMap.id,
    color,
    difficultyPreference,
    holdIds: orderedRoute.map((hold) => hold.id),
    holds: orderedRoute,
    summary:
      `${summary} Confidence ${Math.round(confidence * 100)}%. ` +
      `Start: ${semantics.startLabel}. Finish: ${semantics.finishLabel}. ` +
      `Route spans ${verticalSpan}% of the wall. ${semantics.reviewSummary} ` +
      `${difficultyLabels[difficultyPreference] || difficultyLabels.Intermediate}`.trim(),
    estimatedMoves: Math.max(0, orderedRoute.length - 1),
    semantics,
  };
}
