import { useEffect, useMemo, useState } from 'react';
import type { RoutePlan } from '../../../shared/types/climb';
import { buildGuidanceCues } from '../services/cueGenerator.service';

export function useGuidanceEngine(routePlan: RoutePlan | undefined, initialCueIndex = 0) {
  const cues = useMemo(() => (routePlan ? buildGuidanceCues(routePlan) : []), [routePlan]);
  const [cueIndex, setCueIndex] = useState(initialCueIndex);

  useEffect(() => {
    setCueIndex(initialCueIndex);
  }, [initialCueIndex]);

  const currentCue = cues[cueIndex] ?? null;
  const currentHold = routePlan?.holds[cueIndex] ?? null;
  const progressRatio = cues.length === 0 ? 0 : (cueIndex + 1) / cues.length;
  const completedHoldIds = routePlan?.holds.slice(0, cueIndex).map((hold) => hold.id) ?? [];

  function goToCue(nextIndex: number) {
    setCueIndex(Math.max(0, Math.min(nextIndex, Math.max(0, cues.length - 1))));
  }

  function advanceCue() {
    if (cueIndex < cues.length - 1) {
      setCueIndex((previous) => previous + 1);
      return false;
    }
    return true;
  }

  return {
    cues,
    cueIndex,
    currentCue,
    currentHold,
    progressRatio,
    completedHoldIds,
    setCueIndex: goToCue,
    advanceCue,
    isLastCue: cueIndex >= Math.max(0, cues.length - 1),
  };
}
