import type { Hold, HoldColor, RouteCandidate, RoutePlan, WallMap } from '../../../shared/types/climb';

interface DifficultyProfile {
  maxHorizontalReach: number;
  maxVerticalGain: number;
  maxVerticalDrop: number;
  idealVerticalGain: number;
  maxStartTraverse: number;
  sidePenalty: number;
  confidenceWeight: number;
}

interface RouteEvaluation {
  score: number;
  holds: Hold[];
  topY: number;
}

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
  },
  Intermediate: {
    maxHorizontalReach: 25,
    maxVerticalGain: 24,
    maxVerticalDrop: 3,
    idealVerticalGain: 13,
    maxStartTraverse: 26,
    sidePenalty: 0.34,
    confidenceWeight: 6.4,
  },
  Advanced: {
    maxHorizontalReach: 32,
    maxVerticalGain: 30,
    maxVerticalDrop: 4,
    idealVerticalGain: 16,
    maxStartTraverse: 30,
    sidePenalty: 0.28,
    confidenceWeight: 6.0,
  },
};

function getDifficultyProfile(difficultyPreference: string) {
  return difficultyProfiles[difficultyPreference] ?? difficultyProfiles.Intermediate;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function buildSameColorPath(holds: Hold[], difficultyPreference: string) {
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

function buildCandidateSummary(color: HoldColor, route: Hold[]) {
  const startRegion = inferStartRegion(route);
  const bottomY = Math.max(...route.map((hold) => hold.yPct));
  const topY = Math.min(...route.map((hold) => hold.yPct));
  const verticalSpan = Math.round(Math.max(0, bottomY - topY));
  const startCount = route.filter((hold) => hold.role === 'start' || hold.role === 'foot').length;

  return {
    startRegion,
    verticalSpan,
    summary:
      `${color.toUpperCase()} same-colour line. ${route.length} sequenced holds, ${verticalSpan}% vertical span, ` +
      `${startRegion} start lane, ${startCount} low stability hold${startCount === 1 ? '' : 's'}.`,
  };
}

function buildColorCandidate(wallMap: WallMap, color: HoldColor) {
  const colorHolds = wallMap.holds.filter((hold) => hold.color === color);
  const route = assignRouteRoles(buildSameColorPath(colorHolds, 'Intermediate'));

  if (route.length === 0) {
    return null;
  }

  const averageConfidence = Number(
    (
      route.reduce((sum, hold) => sum + hold.confidence, 0) /
      Math.max(1, route.length)
    ).toFixed(2),
  );
  const candidateSummary = buildCandidateSummary(color, route);

  return {
    id: `same-colour-${wallMap.id}-${color}`,
    color,
    holdIds: route.map((hold) => hold.id),
    confidence: averageConfidence,
    estimatedMoves: Math.max(0, route.length - 1),
    startRegion: candidateSummary.startRegion,
    summary: candidateSummary.summary,
  } satisfies RouteCandidate;
}

export function getAvailableRouteCandidates(wallMap: WallMap): RouteCandidate[] {
  return getAvailableRouteColors(wallMap)
    .map((color) => buildColorCandidate(wallMap, color))
    .filter((candidate): candidate is RouteCandidate => Boolean(candidate && candidate.holdIds.length > 1))
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
  const orderedRoute = assignRouteRoles(buildSameColorPath(sameColorHolds, difficultyPreference));
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
    `${color.toUpperCase()} same-colour route with ${orderedRoute.length} linked holds.`;

  return {
    id: `route_${wallMap.id}_${color}_${difficultyPreference.toLowerCase()}`,
    scanId: wallMap.id,
    color,
    difficultyPreference,
    holdIds: orderedRoute.map((hold) => hold.id),
    holds: orderedRoute,
    summary:
      `${summary} Confidence ${Math.round(confidence * 100)}%. ` +
      `The planner enforces a single-colour line only, links holds through reachable upward movement, ` +
      `and preserves a stable start-to-finish sequence across ${verticalSpan}% of the wall. ` +
      `${difficultyLabels[difficultyPreference] || difficultyLabels.Intermediate}`.trim(),
    estimatedMoves: Math.max(0, orderedRoute.length - 1),
  };
}
