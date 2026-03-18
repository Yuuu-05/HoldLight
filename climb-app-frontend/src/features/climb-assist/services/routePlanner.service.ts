import type { Hold, HoldColor, RouteCandidate, RoutePlan, WallMap } from '../../../shared/types/climb';

const difficultyLabels: Record<string, string> = {
  Beginner: 'larger holds and shorter reach suggestions',
  Intermediate: 'balanced reach spacing for steady movement',
  Advanced: 'smaller holds and longer reach tolerance',
};

const difficultySettings: Record<string, { horizontalReach: number; preferredVerticalStep: number }> = {
  Beginner: { horizontalReach: 24, preferredVerticalStep: 16 },
  Intermediate: { horizontalReach: 32, preferredVerticalStep: 22 },
  Advanced: { horizontalReach: 40, preferredVerticalStep: 28 },
};

export function getAvailableRouteColors(wallMap: WallMap): HoldColor[] {
  return Array.from(new Set(wallMap.holds.map((hold) => hold.color))).filter((color) => color !== 'unknown') as HoldColor[];
}

function buildFallbackRouteCandidates(wallMap: WallMap): RouteCandidate[] {
  return getAvailableRouteColors(wallMap).map((color) => {
    const colorHolds = wallMap.holds.filter((hold) => hold.color === color);
    const meanX = colorHolds.reduce((sum, hold) => sum + hold.xPct, 0) / Math.max(1, colorHolds.length);
    const startRegion = meanX < 33 ? 'left' : meanX > 67 ? 'right' : 'center';

    return {
      id: `fallback-${wallMap.id}-${color}-${startRegion}`,
      color,
      holdIds: colorHolds.map((hold) => hold.id),
      confidence: Number((colorHolds.reduce((sum, hold) => sum + hold.confidence, 0) / Math.max(1, colorHolds.length)).toFixed(2)),
      estimatedMoves: Math.max(0, colorHolds.length - 1),
      startRegion,
      summary: `${color.toUpperCase()} route, ${startRegion} section, ${colorHolds.length} detected holds.`,
    };
  });
}

export function getAvailableRouteCandidates(wallMap: WallMap): RouteCandidate[] {
  if (wallMap.analysis?.routeCandidates?.length) {
    return wallMap.analysis.routeCandidates;
  }

  return buildFallbackRouteCandidates(wallMap);
}

function sortRouteHolds(holds: Hold[]) {
  return [...holds].sort((left, right) => {
    if (right.yPct !== left.yPct) {
      return right.yPct - left.yPct;
    }
    return left.xPct - right.xPct;
  });
}

function scoreCandidate(current: Hold, candidate: Hold, difficultyPreference: string) {
  const settings = difficultySettings[difficultyPreference] || difficultySettings.Intermediate;
  const dx = Math.abs(candidate.xPct - current.xPct);
  const dy = current.yPct - candidate.yPct;
  const reachPenalty = dx > settings.horizontalReach ? (dx - settings.horizontalReach) * 1.6 : 0;
  const verticalPenalty = Math.abs(dy - settings.preferredVerticalStep);
  const downwardPenalty = dy < -1 ? 18 : 0;
  const finishBonus = candidate.role === 'finish' ? -9 : 0;
  const startPenalty = candidate.role === 'start' ? 10 : 0;
  const footBonus = candidate.role === 'foot' ? -2 : 0;

  return dx * 0.9 + verticalPenalty + reachPenalty + downwardPenalty + finishBonus + startPenalty + footBonus;
}

function buildOrderedRoute(holds: Hold[], difficultyPreference: string) {
  if (holds.length <= 2) return sortRouteHolds(holds);

  const sorted = sortRouteHolds(holds);
  const startHolds = sorted.filter((hold) => hold.role === 'start' || hold.role === 'foot').slice(0, 2);
  const route: Hold[] = startHolds.length > 0 ? [...startHolds] : [sorted[0]];
  const usedIds = new Set(route.map((hold) => hold.id));

  while (route.length < sorted.length) {
    const current = route[route.length - 1];
    const remaining = sorted.filter((hold) => !usedIds.has(hold.id));
    const upwardCandidates = remaining.filter((hold) => hold.yPct <= current.yPct + 4);
    const pool = upwardCandidates.length > 0 ? upwardCandidates : remaining;

    const next = [...pool].sort((left, right) => {
      const leftScore = scoreCandidate(current, left, difficultyPreference);
      const rightScore = scoreCandidate(current, right, difficultyPreference);
      if (leftScore !== rightScore) return leftScore - rightScore;
      if (left.yPct !== right.yPct) return right.yPct - left.yPct;
      return left.xPct - right.xPct;
    })[0];

    if (!next) break;
    route.push(next);
    usedIds.add(next.id);
  }

  return route;
}

export function buildRoutePlan(
  wallMap: WallMap,
  selection: HoldColor | RouteCandidate,
  difficultyPreference: string,
): RoutePlan {
  const routeCandidate = typeof selection === 'string'
    ? getAvailableRouteCandidates(wallMap).find((candidate) => candidate.color === selection)
    : selection;
  const color = routeCandidate?.color ?? (typeof selection === 'string' ? selection : selection.color);
  const holdsFromCandidate = routeCandidate?.holdIds.length
    ? routeCandidate.holdIds
      .map((holdId) => wallMap.holds.find((hold) => hold.id === holdId))
      .filter((hold): hold is Hold => Boolean(hold))
    : [];
  const sourceHolds = holdsFromCandidate.length > 0
    ? holdsFromCandidate
    : wallMap.holds.filter((hold) => hold.color === color);
  const candidateHolds = buildOrderedRoute(sourceHolds, difficultyPreference);
  const startCount = candidateHolds.filter((hold) => hold.role === 'start' || hold.role === 'foot').length;
  const finishCount = candidateHolds.filter((hold) => hold.role === 'finish').length;
  const routeLabel = routeCandidate?.summary ?? `${color.toUpperCase()} route`;

  return {
    id: `route_${wallMap.id}_${routeCandidate?.id ?? color}`,
    scanId: wallMap.id,
    color,
    difficultyPreference,
    holdIds: candidateHolds.map((hold) => hold.id),
    holds: candidateHolds,
    summary: `${routeLabel} It includes ${candidateHolds.length} detected holds, ${startCount} low anchor points, ${finishCount} finish targets, and ${difficultyLabels[difficultyPreference] || 'default guidance pacing'}.`,
    estimatedMoves: routeCandidate?.estimatedMoves ?? Math.max(0, candidateHolds.length - 1),
  };
}
