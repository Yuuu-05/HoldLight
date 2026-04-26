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
    return 'Wall alignment is not stable enough yet, so live cueing is paused.';
  }

  const normalizedDetail = detail.trim();
  const lowerDetail = normalizedDetail.toLowerCase();

  if (
    lowerDetail.includes('same wall framing') ||
    (lowerDetail.includes('wall alignment') && lowerDetail.includes('reliable'))
  ) {
    return 'Wall alignment is not stable enough yet, so live cueing is paused.';
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
      'Scan gate cleared',
      'Scan recognition passed the accessibility gate for autonomous guidance.',
      analysis.captureGuidance.slice(0, 2),
    );
  }

  if (analysis.suggestedAction === 'companion') {
    return buildDecision(
      'companion',
      'Companion recommended',
      'The wall is only partly stable for recognition, so autonomous guidance should stay paused.',
      analysis.captureGuidance.slice(0, 2),
    );
  }

  return buildDecision(
    'retake',
    'Retake required',
    'Recognition quality is too weak for autonomous guidance.',
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
        'The scan-to-camera alignment is missing or unreliable.',
        'Keep the camera aligned with the scanned wall and try recalibrating.',
      ],
    );
  }

  if (requiresAlignment && alignmentState.status === 'partial' && alignmentState.qualityPct < 58) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      'Wall alignment is still stabilising, so live cueing is paused for safety.',
      [
        `Alignment quality is only ${alignmentState.qualityPct}%.`,
        'Hold position and keep the wall fully in frame.',
      ],
    );
  }

  if (poseState.error) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      poseState.error,
      ['Pose tracking reported an error.', 'Bring the climber back into frame before continuing.'],
    );
  }

  if (!poseState.active || poseState.poseQualityPct < 48 || poseState.visibleLimbCount < 1) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      'The locked climber is not clear enough in frame for precise live cueing.',
      [
        `Pose quality is ${poseState.poseQualityPct}%.`,
        'A clear full-body view is required before new cues can be trusted.',
      ],
    );
  }

  if (poseState.subjectLockStatus === 'searching') {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      'The system is still searching for the primary climber.',
      [
        'A stable climber lock has not been established yet.',
      ],
    );
  }

  if (poseState.subjectLockStatus === 'holding' || poseState.subjectLockStatus === 'reacquiring') {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      poseState.subjectLockReason,
      [
        'The tracker is preventing a switch to a nearby person.',
        'Wait for the climber lock to settle again before trusting new cues.',
      ],
    );
  }

  if (poseState.interferenceRiskPct >= 62) {
    return buildDecision(
      'pause-live-guidance',
      'Pause live guidance',
      'Nearby movement is interfering with pose tracking, so new live cues are paused.',
      [
        `Interference risk is ${poseState.interferenceRiskPct}%.`,
        'Keep other people out of the camera view if possible.',
      ],
    );
  }

  return buildDecision(
      'ready',
      'Live guidance ready',
      'Pose tracking, wall alignment, and scan safety all look stable enough for live cueing.',
      [
        `Pose quality ${poseState.poseQualityPct}%.`,
        `Wall alignment ${alignmentState.qualityPct}%.`,
      ],
    );
}
