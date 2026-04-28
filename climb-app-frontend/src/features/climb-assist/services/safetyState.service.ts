import type { ClimbScan } from '../../../shared/types/climb';
import type { LivePoseState } from '../hooks/useLivePoseTracker';
import type { LiveWallAlignmentState } from '../hooks/useLiveWallAlignment';

export type AssistSafetyStatus = 'ready' | 'companion' | 'retake' | 'pause-live-guidance';

export interface AssistSafetyDecision {
  status: AssistSafetyStatus;
  headline: string;
  detail: string;
  reasons: string[];
  canSelectRoute: boolean;
  canStartLiveGuidance: boolean;
  canSpeakLiveCue: boolean;
  canAutoAdvance: boolean;
  canPlayProximityCue: boolean;
}

function buildDecision(
  status: AssistSafetyStatus,
  headline: string,
  detail: string,
  reasons: string[],
): AssistSafetyDecision {
  const isReady = status === 'ready';
  return {
    status,
    headline,
    detail,
    reasons,
    canSelectRoute: isReady,
    canStartLiveGuidance: isReady,
    canSpeakLiveCue: isReady,
    canAutoAdvance: isReady,
    canPlayProximityCue: isReady,
  };
}

function formatManualCorrectionReason(count: number, singular: string, plural = `${singular}s`) {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural} saved.`;
}

function normalizeAlignmentPauseDetail(detail: string | null | undefined) {
  if (!detail) {
    return 'Wall alignment is not stable yet, so live guidance is paused.';
  }

  const normalizedDetail = detail.trim();
  const lowerDetail = normalizedDetail.toLowerCase();

  if (
    lowerDetail.includes('same wall framing') ||
    (lowerDetail.includes('wall alignment') && lowerDetail.includes('reliable'))
  ) {
    return 'Wall alignment is not stable yet, so live guidance is paused.';
  }

  if (
    lowerDetail.includes('reference image') ||
    lowerDetail.includes('wall map is missing hold data') ||
    lowerDetail.includes('no scanned wall reference image')
  ) {
    return 'The scan-to-camera alignment is missing or unreliable.';
  }

  return normalizedDetail;
}

export function buildScanSafetyDecision(scan: ClimbScan | null): AssistSafetyDecision {
  if (!scan) {
    return buildDecision(
      'retake',
      'No scan ready',
      'A wall scan is required before route setup can begin.',
      ['No saved wall scan is available yet.'],
    );
  }

  const analysis = scan.wallMap.analysis;
  if (!analysis) {
    return buildDecision(
      'retake',
      'Scan analysis missing',
      'The wall scan does not include a safety analysis yet.',
      ['No recognition analysis was saved with the wall scan.'],
    );
  }

  if (analysis.manualReview?.holdColorsReviewed && analysis.routeCandidates.length > 0) {
    const colorCorrectionCount = analysis.manualReview.colorCorrectionCount ?? 0;
    const holdAdditionCount = analysis.manualReview.holdAdditionCount ?? 0;
    const holdDeletionCount = analysis.manualReview.holdDeletionCount ?? 0;
    const totalCorrectionCount =
      analysis.manualReview.totalCorrectionCount
      ?? colorCorrectionCount + holdAdditionCount + holdDeletionCount;
    const correctionReasons = [
      formatManualCorrectionReason(colorCorrectionCount, 'hold color correction'),
      formatManualCorrectionReason(holdAdditionCount, 'added hold'),
      formatManualCorrectionReason(holdDeletionCount, 'removed hold'),
    ].filter((reason): reason is string => Boolean(reason));

    return buildDecision(
      'ready',
      'Companion review complete',
      'A companion reviewed the detected holds before route setup.',
      [
        ...(correctionReasons.length
          ? correctionReasons
          : [formatManualCorrectionReason(totalCorrectionCount, 'manual hold correction', 'manual hold corrections') ?? 'Manual hold review saved.']),
        `${analysis.routeCandidates.length} route candidate${analysis.routeCandidates.length === 1 ? '' : 's'} available after review.`,
      ],
    );
  }

  if (analysis.shouldAllowAutonomousGuidance && analysis.routeCandidates.length > 0) {
    return buildDecision(
      'ready',
      'Scan ready',
      'Recognition is clear enough for route guidance.',
      analysis.captureGuidance.slice(0, 2),
    );
  }

  if (analysis.suggestedAction === 'companion') {
    return buildDecision(
      'companion',
      'Companion recommended',
      'Recognition is only partly stable. Use companion support before continuing.',
      analysis.captureGuidance.slice(0, 2),
    );
  }

  return buildDecision(
    'retake',
    'Retake required',
    'Recognition is not clear enough yet.',
    analysis.captureGuidance.slice(0, 2),
  );
}

export function buildLiveGuidanceSafetyDecision({
  scan,
  poseState,
  alignmentState,
}: {
  scan: ClimbScan | null;
  poseState: LivePoseState;
  alignmentState: LiveWallAlignmentState;
}): AssistSafetyDecision {
  const scanDecision = buildScanSafetyDecision(scan);
  if (scanDecision.status !== 'ready') {
    return {
      ...scanDecision,
      canSpeakLiveCue: false,
      canAutoAdvance: false,
      canPlayProximityCue: false,
      canStartLiveGuidance: false,
    };
  }

  const requiresAlignment = Boolean(scan);

  if (requiresAlignment && (!alignmentState.active || alignmentState.status === 'unavailable')) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      normalizeAlignmentPauseDetail(alignmentState.error),
      [
        'The scan and live camera are not aligned.',
        'Keep the camera on the scanned wall and recalibrate.',
      ],
    );
  }

  if (requiresAlignment && alignmentState.status === 'partial' && alignmentState.qualityPct < 58) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      'Wall alignment is still stabilizing, so live guidance is paused.',
      [
        `Alignment quality is only ${alignmentState.qualityPct}%.`,
        'Hold still and keep the full wall in frame.',
      ],
    );
  }

  if (poseState.error) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      poseState.error,
      ['Pose tracking had an error.', 'Bring the climber back into frame before continuing.'],
    );
  }

  if (!poseState.active || poseState.poseQualityPct < 48 || poseState.visibleLimbCount < 1) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      'The climber is not clear enough in frame for live guidance.',
      [
        `Pose quality is ${poseState.poseQualityPct}%.`,
        'Show the full body clearly before following new cues.',
      ],
    );
  }

  if (poseState.subjectLockStatus === 'searching') {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      'The system is still finding the climber.',
      [
        'Keep the climber in frame until tracking is stable.',
      ],
    );
  }

  if (poseState.subjectLockStatus === 'holding' || poseState.subjectLockStatus === 'reacquiring') {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      poseState.subjectLockReason,
      [
        'Tracking is avoiding a nearby person.',
        'Wait until the climber is tracked again.',
      ],
    );
  }

  if (poseState.interferenceRiskPct >= 62) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      'Nearby movement is affecting tracking, so live guidance is paused.',
      [
        `Interference risk is ${poseState.interferenceRiskPct}%.`,
        'Keep other people out of the camera view if possible.',
      ],
    );
  }

  return buildDecision(
      'ready',
      'Live guidance ready',
      'Pose tracking, wall alignment, and scan quality are ready for live guidance.',
      [
        `Pose quality ${poseState.poseQualityPct}%.`,
        `Wall alignment ${alignmentState.qualityPct}%.`,
      ],
    );
}
