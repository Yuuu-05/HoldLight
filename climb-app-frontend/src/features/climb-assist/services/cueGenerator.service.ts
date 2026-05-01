import type { GuidanceCue, GuidanceLimb, Hold, RoutePlan } from '../../../shared/types/climb';

interface DistanceBand {
  key: string;
  label: string;
}

interface LivePositionGuidance {
  displayText: string;
  speechText: string | null;
  speechKey: string;
}

const CLOCK_LABELS = [
  '12 o’clock',
  '1 o’clock',
  '2 o’clock',
  '3 o’clock',
  '4 o’clock',
  '5 o’clock',
  '6 o’clock',
  '7 o’clock',
  '8 o’clock',
  '9 o’clock',
  '10 o’clock',
  '11 o’clock',
];

function oppositeHand(limb: GuidanceLimb) {
  return limb === 'leftHand' ? 'rightHand' : 'leftHand';
}

function oppositeFoot(limb: GuidanceLimb) {
  return limb === 'leftFoot' ? 'rightFoot' : 'leftFoot';
}

function limbLabel(limb: GuidanceLimb | undefined) {
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

function isFootLimb(limb: GuidanceLimb | undefined) {
  return limb === 'leftFoot' || limb === 'rightFoot';
}

function getClockDirectionFromDelta(dx: number, dy: number) {
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  const normalized = (angle + 360) % 360;
  const index = Math.round(normalized / 30) % 12;
  return CLOCK_LABELS[index];
}

function getClockDirection(from: Hold | { xPct: number; yPct: number } | null, to: Hold) {
  if (!from) return '12 o’clock';
  const dx = to.xPct - from.xPct;
  const dy = from.yPct - to.yPct;
  return getClockDirectionFromDelta(dx, dy);
}

function getDistanceBand(distance: number): DistanceBand {
  if (distance < 4.5) return { key: 'very-short', label: 'very short' };
  if (distance < 9) return { key: 'short', label: 'short' };
  if (distance < 15) return { key: 'medium', label: 'medium' };
  if (distance < 23) return { key: 'far', label: 'far' };
  return { key: 'extra-far', label: 'extra far' };
}

function getHoldDescriptor(hold: Hold, limb: GuidanceLimb | undefined) {
  if (hold.role === 'finish') {
    return `${hold.color} finish hold`;
  }

  if (isFootLimb(limb) || hold.role === 'foot') {
    if (hold.size === 's') return `${hold.color} small foothold`;
    if (hold.size === 'l') return `${hold.color} positive foothold`;
    return `${hold.color} foothold`;
  }

  if (hold.role === 'start') {
    return `${hold.color} starting handhold`;
  }

  if (hold.size === 'l') return `${hold.color} large positive handhold`;
  if (hold.size === 's') return `${hold.color} small edge`;
  return `${hold.color} handhold`;
}

function getRouteHeightDescriptor(previousHold: Hold | null, hold: Hold, limb: GuidanceLimb) {
  if (!previousHold) {
    return hold.role === 'start' ? 'start height' : 'reachable from the start stance';
  }

  const upwardGain = previousHold.yPct - hold.yPct;

  if (isFootLimb(limb)) {
    if (upwardGain > 16) return 'high-step height';
    if (upwardGain > 9) return 'knee-to-hip height';
    if (upwardGain > 3) return 'knee height';
    return 'low foot height';
  }

  if (upwardGain > 18) return 'above shoulder height';
  if (upwardGain > 11) return 'shoulder height';
  if (upwardGain > 5) return 'chest height';
  if (upwardGain > 1) return 'hip-to-chest height';
  return 'same-height bump';
}

function getFootDirection(previousHold: Hold | null, hold: Hold, limb: GuidanceLimb) {
  if (!previousHold) {
    return hold.xPct < 50 ? 'inside edge' : 'outside edge';
  }

  const horizontalDelta = hold.xPct - previousHold.xPct;
  if (Math.abs(horizontalDelta) < 4) return 'under the hip line';

  if (limb === 'leftFoot') {
    return horizontalDelta >= 0 ? 'inside edge' : 'outside edge';
  }

  return horizontalDelta <= 0 ? 'inside edge' : 'outside edge';
}

function buildTechniqueHint(previousHold: Hold | null, hold: Hold, limb: GuidanceLimb) {
  if (!previousHold) {
    return 'Establish three points of contact before asking for the next call.';
  }

  const horizontalDelta = hold.xPct - previousHold.xPct;
  const verticalDelta = previousHold.yPct - hold.yPct;

  if (hold.role === 'finish') {
    return 'Control the finish, settle the feet, and match if it feels stable.';
  }

  if (isFootLimb(limb)) {
    if (verticalDelta > 16) {
      return 'High-step onto it, place the foot quietly, and stand through the leg.';
    }
    if (Math.abs(horizontalDelta) > 12) {
      return 'Use the edge cleanly and keep the hips close to the wall before moving the hands.';
    }
    return 'Set the foot silently, weight it, then release the hand move.';
  }

  if (Math.abs(horizontalDelta) > 18) {
    return 'This is a cross-through style hand move, so stay tight to the wall and keep the feet quiet.';
  }
  if (verticalDelta > 15) {
    return 'Move statically, lock off, and drive upward through the feet.';
  }
  if (Math.abs(horizontalDelta) < 6 && Math.abs(verticalDelta) < 6) {
    return 'Use a controlled bump, pause, and re-centre before the next call.';
  }

  return 'Stay square to the wall, keep tension through the feet, and move one limb at a time.';
}

function inferLimbForCue(
  previousHold: Hold | null,
  hold: Hold,
  index: number,
  lastHand: GuidanceLimb,
  lastFoot: GuidanceLimb,
) {
  if (index === 0) return 'match' as const;

  if (hold.role === 'foot') {
    const preferredFoot = hold.xPct < 50 ? 'leftFoot' : 'rightFoot';
    if (preferredFoot === lastFoot) {
      return oppositeFoot(lastFoot);
    }
    return preferredFoot;
  }

  const preferredHand = hold.xPct < 50 ? 'leftHand' : 'rightHand';
  if (!previousHold) return preferredHand;

  const nearPreviousLane = Math.abs(hold.xPct - previousHold.xPct) < 5;
  if (nearPreviousLane) {
    return oppositeHand(lastHand);
  }

  if (preferredHand === lastHand && Math.abs(hold.xPct - previousHold.xPct) > 12) {
    return oppositeHand(lastHand);
  }

  return preferredHand;
}

function buildOpeningCue(hold: Hold) {
  return `Establish on the ${getHoldDescriptor(hold, 'match')}. Stay on the ${hold.color} line only, build three points of contact, and wait for the next caller cue.`;
}

function buildMovementCue(previousHold: Hold | null, hold: Hold, limb: GuidanceLimb) {
  if (!previousHold) {
    return buildOpeningCue(hold);
  }

  const dx = hold.xPct - previousHold.xPct;
  const dy = previousHold.yPct - hold.yPct;
  const distanceBand = getDistanceBand(Math.hypot(dx, dy));
  const targetDescriptor = getHoldDescriptor(hold, limb);
  const heightDescriptor = getRouteHeightDescriptor(previousHold, hold, limb);
  const technique = buildTechniqueHint(previousHold, hold, limb);

  if (isFootLimb(limb)) {
    const footDirection = getFootDirection(previousHold, hold, limb);
    return `${limbLabel(limb)}. ${footDirection}. ${distanceBand.label}. ${heightDescriptor}. ${targetDescriptor}. ${technique} Target ${hold.label}.`;
  }

  const clock = getClockDirection(previousHold, hold);
  return `${limbLabel(limb)}. ${clock}. ${distanceBand.label}. ${heightDescriptor}. ${targetDescriptor}. ${technique} Target ${hold.label}.`;
}

function formatLiveDistanceLabel(distanceBand: DistanceBand) {
  switch (distanceBand.key) {
    case 'very-short':
      return 'very close';
    case 'short':
      return 'close';
    case 'medium':
      return 'medium distance';
    case 'far':
      return 'far';
    default:
      return 'very far';
  }
}

function buildChestCenteredCue(clock: string, distanceBand: DistanceBand) {
  return `${clock}, ${formatLiveDistanceLabel(distanceBand)}.`;
}

export function buildLivePositionGuidance({
  targetHold,
  activeAnchor,
  distancePct,
}: {
  targetHold: Hold | null;
  activeAnchor: { xPct: number; yPct: number } | null | undefined;
  distancePct: number | null;
}): LivePositionGuidance {
  if (!targetHold) {
    return {
      displayText: 'Caller is waiting for the next same-colour target.',
      speechText: null,
      speechKey: 'waiting-target',
    };
  }

  if (!activeAnchor || distancePct === null) {
    const hiddenLimbText = 'Chest not clear. Center the upper body in the camera.';
    return {
      displayText: hiddenLimbText,
      speechText: hiddenLimbText,
      speechKey: `${targetHold.id}:chest-hidden`,
    };
  }

  const dx = targetHold.xPct - activeAnchor.xPct;
  const dy = activeAnchor.yPct - targetHold.yPct;
  const distanceBand = getDistanceBand(distancePct);
  const clock = getClockDirectionFromDelta(dx, dy);
  const speechText = buildChestCenteredCue(clock, distanceBand);
  return {
    displayText: speechText,
    speechText,
    speechKey: `${targetHold.id}:chest:${distanceBand.key}:${clock}`,
  };
}

export function buildGuidanceCues(routePlan: RoutePlan): GuidanceCue[] {
  let lastHand: GuidanceLimb = 'rightHand';
  let lastFoot: GuidanceLimb = 'rightFoot';

  return routePlan.holds.map((hold, index) => {
    const previousHold = index === 0 ? null : routePlan.holds[index - 1];
    const limb = inferLimbForCue(previousHold, hold, index, lastHand, lastFoot);

    if (limb === 'leftHand' || limb === 'rightHand') {
      lastHand = limb;
    }
    if (limb === 'leftFoot' || limb === 'rightFoot') {
      lastFoot = limb;
    }

    const title =
      index === 0
        ? 'Establish the start'
        : hold.role === 'finish'
          ? 'Finish move'
          : hold.role === 'foot'
            ? 'Set the foot'
            : `Move ${index + 1}`;

    return {
      holdId: hold.id,
      title,
      message: buildMovementCue(previousHold, hold, limb),
      progressLabel: `${index + 1} / ${routePlan.holds.length}`,
      limb,
      direction: isFootLimb(limb)
        ? getFootDirection(previousHold, hold, limb)
        : getClockDirection(previousHold, hold),
    };
  });
}
