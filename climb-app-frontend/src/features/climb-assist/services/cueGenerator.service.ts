import type { GuidanceCue, GuidanceLimb, Hold, RoutePlan } from '../../../shared/types/climb';

function buildDirection(from: Hold | null, to: Hold) {
  if (!from) {
    return 'Set a stable start position before moving.';
  }

  const horizontalDelta = to.xPct - from.xPct;
  const verticalDelta = to.yPct - from.yPct;

  const horizontal = Math.abs(horizontalDelta) < 6 ? 'center' : horizontalDelta > 0 ? 'right' : 'left';
  const vertical = Math.abs(verticalDelta) < 6 ? 'same height' : verticalDelta > 0 ? 'down' : 'up';

  if (to.role === 'finish') {
    return `Reach ${horizontal === 'center' ? 'straight' : horizontal} and ${vertical === 'same height' ? 'steady' : vertical} to the finish hold.`;
  }

  if (vertical === 'up') {
    return `Move ${horizontal === 'center' ? 'straight up' : `${horizontal} and up`} toward the next ${to.color} hold.`;
  }

  if (vertical === 'down') {
    return `Drop ${horizontal === 'center' ? 'straight down' : `${horizontal} and down`} to reset on the next hold.`;
  }

  if (horizontal === 'center') {
    return `Keep your body close and match onto the next ${to.color} hold.`;
  }

  return `Shift ${horizontal} while keeping your hips close to the wall.`;
}

function inferLimb(previousHold: Hold | null, hold: Hold, index: number): GuidanceLimb {
  if (!previousHold) return 'match';
  if (hold.role === 'foot') {
    return hold.xPct < 50 ? 'leftFoot' : 'rightFoot';
  }

  if (hold.role === 'finish') {
    return hold.xPct < previousHold.xPct ? 'leftHand' : 'rightHand';
  }

  if (index % 2 === 0) {
    return hold.xPct < 50 ? 'leftHand' : 'rightHand';
  }

  return hold.xPct >= previousHold.xPct ? 'rightHand' : 'leftHand';
}

function limbLabel(limb: GuidanceLimb) {
  switch (limb) {
    case 'leftHand':
      return 'Left hand';
    case 'rightHand':
      return 'Right hand';
    case 'leftFoot':
      return 'Left foot';
    case 'rightFoot':
      return 'Right foot';
    default:
      return 'Both hands';
  }
}

export function buildGuidanceCues(routePlan: RoutePlan): GuidanceCue[] {
  return routePlan.holds.map((hold, index) => {
    const previousHold = index === 0 ? null : routePlan.holds[index - 1];
    const direction = buildDirection(previousHold, hold);
    const limb = inferLimb(previousHold, hold, index);
    const title = index === 0 ? 'Set your start position' : hold.role === 'finish' ? 'Finish move' : `Move ${index + 1}`;
    const leadIn = index === 0 ? 'Start position.' : `${limbLabel(limb)}.`;

    return {
      holdId: hold.id,
      title,
      message: `${leadIn} ${direction} Target: ${hold.label}.`,
      progressLabel: `${index + 1} / ${routePlan.holds.length}`,
      limb,
      direction,
    };
  });
}
