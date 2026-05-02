import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { useCamera } from '../../../app/providers/CameraProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import {
  getClimbSessionApi,
  getLatestClimbScanApi,
  saveGuidanceLogsApi,
  updateClimbSessionApi,
} from '../../../shared/api/climbing.api';
import MascotStatusLoader from '../../../shared/components/illustration/MascotStatusLoader';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { playProximityBeep } from '../../../shared/lib/audioCue';
import { isSpeechPlaying, type SpeechLanguage } from '../../../shared/lib/speech';
import type { ClimbScan, ClimbSession, GuidanceLimb, Hold } from '../../../shared/types/climb';
import CameraPreview from '../components/CameraPreview';
import LiveGuidanceOverlay from '../components/LiveGuidanceOverlay';
import VoiceCuePanel from '../components/VoiceCuePanel';
import { useGuidanceEngine } from '../hooks/useGuidanceEngine';
import { useLivePoseTracker } from '../hooks/useLivePoseTracker';
import { useLiveWallAlignment } from '../hooks/useLiveWallAlignment';
import { getActiveStoredScan, getActiveStoredSession } from '../store/climbAssist.store';
import { buildLivePositionGuidance } from '../services/cueGenerator.service';
import {
  buildLivePositionSpeechZh,
  buildLiveSafetyPauseSpeechZh,
  buildPoseTrackerStatus,
  buildRecalibrationSpeechZh,
} from '../services/liveGuidanceSpeech.service';
import { limbToPoseJointName } from '../services/poseTracker.service';
import { buildLiveGuidanceSafetyDecision } from '../services/safetyState.service';
import {
  formatAlignmentStatus,
  formatHoldTarget,
  localizeAssistText,
} from '../utils/localizedAssistText';
import type { PoseFrame, PoseJointName, PosePoint } from '../services/poseTracker.service';

const LIVE_GUIDANCE_FRAME_ASPECT_RATIO = 3 / 4;
const INITIAL_LIVE_CUE_DELAY_MS = 550;
const LIVE_CUE_RETRY_INTERVAL_MS = 700;
const LIVE_CUE_RETRY_WINDOW_MS = 5000;
const LIVE_CUE_CLOSE_SPACING_MS = 4200;
const LIVE_CUE_DEFAULT_SPACING_MS = 7000;

function isFootLimb(limb?: GuidanceLimb) {
  return limb === 'leftFoot' || limb === 'rightFoot';
}

function getCueAnchor(
  limb: GuidanceLimb | undefined,
  poseState: ReturnType<typeof useLivePoseTracker>,
) {
  const activeJointName = limbToPoseJointName(limb);
  if (activeJointName) {
    const joint = poseState.poseFrame?.joints[activeJointName];
    if (joint && joint.visibility >= 0.35) {
      return joint;
    }
  }

  const { anchors } = poseState;
  switch (limb) {
    case 'leftHand':
      return anchors.leftHand;
    case 'rightHand':
      return anchors.rightHand;
    case 'leftFoot':
      return anchors.leftFoot;
    case 'rightFoot':
      return anchors.rightFoot;
    default:
      return anchors.rightHand ?? anchors.leftHand ?? anchors.center;
  }
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

function getChestAnchor(poseState: ReturnType<typeof useLivePoseTracker>) {
  const joints = poseState.poseFrame?.joints;
  const shoulders = averageVisibleCorePoints([joints?.leftShoulder, joints?.rightShoulder]);
  const hips = averageVisibleCorePoints([joints?.leftHip, joints?.rightHip]);

  if (shoulders && hips) {
    return {
      xPct: Number(((shoulders.xPct * 0.68) + (hips.xPct * 0.32)).toFixed(2)),
      yPct: Number(((shoulders.yPct * 0.68) + (hips.yPct * 0.32)).toFixed(2)),
      visibility: Number(Math.min(shoulders.visibility, hips.visibility).toFixed(2)),
    };
  }

  if (shoulders) {
    return {
      xPct: Number(shoulders.xPct.toFixed(2)),
      yPct: Number(Math.min(100, shoulders.yPct + 6).toFixed(2)),
      visibility: Number(shoulders.visibility.toFixed(2)),
    };
  }

  if (hips) {
    return {
      xPct: Number(hips.xPct.toFixed(2)),
      yPct: Number(Math.max(0, hips.yPct - 12).toFixed(2)),
      visibility: Number(hips.visibility.toFixed(2)),
    };
  }

  return poseState.anchors.center;
}

function getDistancePct(anchor: { xPct: number; yPct: number } | undefined, hold: Hold | null) {
  if (!anchor || !hold) return null;
  const dx = anchor.xPct - hold.xPct;
  const dy = anchor.yPct - hold.yPct;
  return Math.sqrt(dx * dx + dy * dy);
}

function getNearestLimbDistancePct(
  poseState: ReturnType<typeof useLivePoseTracker>,
  hold: Hold | null,
) {
  if (!hold) return null;

  const distances = [
    poseState.anchors.leftHand,
    poseState.anchors.rightHand,
    poseState.anchors.leftFoot,
    poseState.anchors.rightFoot,
  ].flatMap((anchor) => {
    const distance = getDistancePct(anchor, hold);
    return typeof distance === 'number' ? [distance] : [];
  });

  return distances.length > 0 ? Math.min(...distances) : null;
}

function getTargetThreshold(hold: Hold | null, limb?: GuidanceLimb) {
  if (!hold) return 7;
  const base = Math.max(2.8, (hold.radiusPct ?? 3.2) * 0.9) + (isFootLimb(limb) ? 4.4 : 3.6);
  return Number(base.toFixed(2));
}

function clampPct(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getCenteredSourceCrop(sourceWidth: number, sourceHeight: number, targetAspectRatio: number) {
  const sourceAspectRatio = sourceWidth / sourceHeight;

  if (sourceAspectRatio > targetAspectRatio) {
    const cropWidth = sourceHeight * targetAspectRatio;
    return {
      sx: (sourceWidth - cropWidth) / 2,
      sy: 0,
      sw: cropWidth,
      sh: sourceHeight,
    };
  }

  const cropHeight = sourceWidth / targetAspectRatio;
  return {
    sx: 0,
    sy: (sourceHeight - cropHeight) / 2,
    sw: sourceWidth,
    sh: cropHeight,
  };
}

function transformPosePointToLiveFrame(
  point: PosePoint | undefined,
  crop: ReturnType<typeof getCenteredSourceCrop>,
  sourceWidth: number,
  sourceHeight: number,
) {
  if (!point) return undefined;

  const xPct = ((point.xPct / 100 * sourceWidth) - crop.sx) / crop.sw * 100;
  const yPct = ((point.yPct / 100 * sourceHeight) - crop.sy) / crop.sh * 100;
  const insideFrame = xPct >= 0 && xPct <= 100 && yPct >= 0 && yPct <= 100;

  return {
    xPct: Number(clampPct(xPct).toFixed(2)),
    yPct: Number(clampPct(yPct).toFixed(2)),
    visibility: insideFrame ? point.visibility : 0,
  };
}

function transformPoseFrameToLiveFrame(
  poseFrame: PoseFrame | null,
  crop: ReturnType<typeof getCenteredSourceCrop>,
  sourceWidth: number,
  sourceHeight: number,
) {
  if (!poseFrame) return null;

  const joints: PoseFrame['joints'] = {};
  (Object.entries(poseFrame.joints) as Array<[PoseJointName, PosePoint | undefined]>).forEach(([jointName, point]) => {
    const transformedPoint = transformPosePointToLiveFrame(point, crop, sourceWidth, sourceHeight);
    if (transformedPoint) {
      joints[jointName] = transformedPoint;
    }
  });

  return {
    ...poseFrame,
    joints,
  };
}

function normalizePoseStateToLiveFrame(
  poseState: ReturnType<typeof useLivePoseTracker>,
  videoElement: HTMLVideoElement | null,
) {
  const sourceWidth = videoElement?.videoWidth ?? 0;
  const sourceHeight = videoElement?.videoHeight ?? 0;

  if (!sourceWidth || !sourceHeight) {
    return poseState;
  }

  const crop = getCenteredSourceCrop(sourceWidth, sourceHeight, LIVE_GUIDANCE_FRAME_ASPECT_RATIO);
  const transformAnchor = (anchor: { xPct: number; yPct: number; visibility: number } | undefined) => {
    const transformedAnchor = transformPosePointToLiveFrame(anchor, crop, sourceWidth, sourceHeight);
    return transformedAnchor && transformedAnchor.visibility >= 0.35 ? transformedAnchor : undefined;
  };

  return {
    ...poseState,
    anchors: {
      leftHand: transformAnchor(poseState.anchors.leftHand),
      rightHand: transformAnchor(poseState.anchors.rightHand),
      leftFoot: transformAnchor(poseState.anchors.leftFoot),
      rightFoot: transformAnchor(poseState.anchors.rightFoot),
      center: transformAnchor(poseState.anchors.center),
    },
    poseFrame: transformPoseFrameToLiveFrame(poseState.poseFrame, crop, sourceWidth, sourceHeight),
  };
}

export default function LiveGuidancePage() {
  const { speak, repeatWithOptions, warm } = useSpeech();
  const { stream, supported: cameraSupported, requestAccess, stopStream } = useCamera();
  const { language, t } = useLanguage();
  const speechLanguage = language === 'zh' ? 'ZH' : 'EN';
  const [session, setSession] = useState<ClimbSession | null>(null);
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [loadingLiveData, setLoadingLiveData] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [finishPending, setFinishPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const guidance = useGuidanceEngine(session?.plannedRoute, session?.cueIndex ?? 0);
  const poseState = useLivePoseTracker(videoElement, Boolean(stream && session?.plannedRoute));

  const lastLiveSpeechAtRef = useRef(0);
  const lastLiveSpeechStepRef = useRef('');
  const liveCueRetryTimerRef = useRef<number | null>(null);
  const pendingLiveSpeechStepRef = useRef('');
  const latestLiveSpeechRef = useRef<{
    stepKey: string;
    speechText: string;
    language: SpeechLanguage;
  } | null>(null);
  const reachedSinceRef = useRef<number | null>(null);
  const lastAutoAdvanceRef = useRef(0);
  const lastBeepRef = useRef(0);
  const lastSafetyStateRef = useRef('');
  const lastSafetyAnnouncementRef = useRef('');
  const pendingSafetyAnnouncementRef = useRef('');
  const safetyAnnouncementRetryTimerRef = useRef<number | null>(null);
  const finishPendingRef = useRef(false);

  usePageTitle('Live guidance');

  const clearLiveCueRetryTimer = useCallback(() => {
    if (liveCueRetryTimerRef.current !== null) {
      window.clearTimeout(liveCueRetryTimerRef.current);
      liveCueRetryTimerRef.current = null;
    }
    pendingLiveSpeechStepRef.current = '';
  }, []);

  const clearSafetyAnnouncementRetryTimer = useCallback(() => {
    if (safetyAnnouncementRetryTimerRef.current !== null) {
      window.clearTimeout(safetyAnnouncementRetryTimerRef.current);
      safetyAnnouncementRetryTimerRef.current = null;
    }
    pendingSafetyAnnouncementRef.current = '';
  }, []);

  const speakLocalized = useCallback((text: string, languageOverride?: 'ZH' | 'EN') => {
    const localizedText = language === 'zh' ? localizeAssistText(text, language) : text;
    speak(localizedText, { language: languageOverride ?? speechLanguage });
  }, [language, speak, speechLanguage]);

  useEffect(() => {
    warm(speechLanguage);
  }, [speechLanguage, warm]);

  useEffect(
    () => () => {
      clearLiveCueRetryTimer();
      clearSafetyAnnouncementRetryTimer();
    },
    [clearLiveCueRetryTimer, clearSafetyAnnouncementRetryTimer],
  );

  useEffect(
    () => () => {
      stopStream();
    },
    [stopStream],
  );

  useEffect(() => {
    let active = true;

    setLoadingLiveData(true);
    Promise.all([
      getClimbSessionApi().catch(() => getActiveStoredSession()),
      getLatestClimbScanApi().catch(() => getActiveStoredScan()),
    ]).then(([activeSession, latestScan]) => {
      if (!active) return;
      setSession(activeSession ?? getActiveStoredSession());
      setScan(latestScan ?? getActiveStoredScan());
      setLoadError(null);
    }).catch((error) => {
      if (!active) return;
      setSession(getActiveStoredSession());
      setScan(getActiveStoredScan());
      setLoadError(error instanceof Error ? error.message : 'Unable to load live guidance data.');
    }).finally(() => {
      if (active) {
        setLoadingLiveData(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loadingLiveData || loadError || session?.plannedRoute) return undefined;

    const timer = window.setTimeout(() => {
      navigate(routes.routeRecommendation, { replace: true });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [loadError, loadingLiveData, navigate, session?.plannedRoute]);

  const currentHold = useMemo(() => {
    if (!session?.plannedRoute) return null;

    const holdFromRoute = session.plannedRoute.holds.find(
      (hold) => hold.id === guidance.currentHold?.id,
    );
    if (holdFromRoute) return holdFromRoute;

    return (
      scan?.wallMap.holds.find((hold) => hold.id === session.currentTargetHoldId) ??
      guidance.currentHold ??
      null
    );
  }, [guidance.currentHold, scan?.wallMap.holds, session?.currentTargetHoldId, session?.plannedRoute]);

  const {
    alignmentState,
    alignedRoutePlan,
    alignedCurrentHold,
    recalibrate,
  } = useLiveWallAlignment({
    videoElement,
    referenceImageUrl: scan?.coverImageUrl ?? null,
    wallMap: scan?.wallMap,
    routePlan: session?.plannedRoute ?? null,
    currentHold,
    enabled: Boolean(stream && session?.plannedRoute),
  });

  useEffect(() => {
    const hasLiveTrack = Boolean(
      stream?.active && stream.getVideoTracks().some((track) => track.readyState === 'live'),
    );

    if (!cameraSupported || hasLiveTrack) return;
    void requestAccess({
      preferredFacingMode: 'environment',
      allowFallback: true,
    });
  }, [cameraSupported, requestAccess, stream]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setIsSpeaking(isSpeechPlaying());
    }, 180);

    return () => window.clearInterval(interval);
  }, []);

  const liveRoutePlan = alignedRoutePlan ?? session?.plannedRoute ?? null;
  const liveCurrentHold = alignedCurrentHold ?? currentHold;
  const livePoseState = useMemo(
    () => normalizePoseStateToLiveFrame(poseState, videoElement),
    [poseState, videoElement],
  );

  const reachAnchor = useMemo(
    () => getCueAnchor(guidance.currentCue?.limb, livePoseState),
    [guidance.currentCue?.limb, livePoseState],
  );

  const chestAnchor = useMemo(
    () => getChestAnchor(livePoseState),
    [livePoseState],
  );

  const reachDistancePct = useMemo(
    () => getDistancePct(reachAnchor, liveCurrentHold),
    [reachAnchor, liveCurrentHold],
  );

  const nearestLimbDistancePct = useMemo(
    () => getNearestLimbDistancePct(livePoseState, liveCurrentHold),
    [liveCurrentHold, livePoseState],
  );

  const targetThreshold = useMemo(
    () => getTargetThreshold(liveCurrentHold, guidance.currentCue?.limb),
    [guidance.currentCue?.limb, liveCurrentHold],
  );

  const alignmentPct = useMemo(() => {
    if (reachDistancePct === null) return undefined;
    return Math.max(0, Math.min(100, Math.round(100 - reachDistancePct * 6)));
  }, [reachDistancePct]);

  const liveSafetyDecision = useMemo(
    () => buildLiveGuidanceSafetyDecision({ scan, poseState: livePoseState, alignmentState }),
    [alignmentState, livePoseState, scan],
  );

  const livePositionGuidance = useMemo(
    () =>
      buildLivePositionGuidance({
        targetHold: liveCurrentHold,
        activeAnchor: chestAnchor,
        distancePct: nearestLimbDistancePct,
      }),
    [chestAnchor, liveCurrentHold, nearestLimbDistancePct],
  );

  const livePositionSpeechZh = useMemo(
    () =>
      buildLivePositionSpeechZh({
        targetHold: liveCurrentHold,
        activeAnchor: chestAnchor,
        distancePct: nearestLimbDistancePct,
      }),
    [chestAnchor, liveCurrentHold, nearestLimbDistancePct],
  );

  const trackerHint = useMemo(() => livePositionGuidance.displayText, [livePositionGuidance.displayText]);

  const safetyPauseSpeechZh = useMemo(
    () =>
      buildLiveSafetyPauseSpeechZh({
        decision: liveSafetyDecision,
        poseState: livePoseState,
        alignmentState,
        scan,
      }),
    [alignmentState, livePoseState, liveSafetyDecision, scan],
  );

  const trackerStatus = useMemo(() => buildPoseTrackerStatus(livePoseState, language), [language, livePoseState]);
  const localizedSafetyHeadline = localizeAssistText(liveSafetyDecision.headline, language);
  const localizedSafetyDetail = localizeAssistText(liveSafetyDecision.detail, language);
  const trackerStatusText = controlError
    ? localizeAssistText(controlError, language)
    : language === 'zh'
      ? `${trackerStatus.headline}。${trackerStatus.detail}`
      : `${trackerStatus.headline}. ${trackerStatus.detail}`;
  const safetyStatusText = language === 'zh'
    ? `${localizedSafetyHeadline}。${localizedSafetyDetail}`
    : `${localizedSafetyHeadline}. ${localizedSafetyDetail}`;
  const displayTrackerHint = language === 'zh'
    ? livePositionSpeechZh.speechText ?? localizeAssistText(trackerHint, language)
    : trackerHint;
  const displayPanelCue = controlError
    ? localizeAssistText(controlError, language)
    : liveSafetyDecision.status === 'ready'
      ? displayTrackerHint || t('No cue available')
      : language === 'zh'
        ? safetyPauseSpeechZh
        : localizedSafetyDetail;
  const localizedPanelCue = language === 'zh'
    ? localizeAssistText(displayPanelCue, language)
    : displayPanelCue;
  const manualCue = displayTrackerHint || t('No cue available');
  const safetyPauseSpeech = language === 'zh' ? safetyPauseSpeechZh : localizedSafetyDetail;
  const livePositionSpeechText = language === 'zh'
    ? livePositionSpeechZh.speechText
    : livePositionGuidance.speechText;

  const completedHoldIds = useMemo(
    () => session?.plannedRoute?.holds.slice(0, guidance.cueIndex).map((hold) => hold.id) ?? [],
    [guidance.cueIndex, session?.plannedRoute?.holds],
  );

  useEffect(() => {
    if (!session) return;

    const safetyKey = `${liveSafetyDecision.status}:${liveSafetyDecision.detail}`;
    if (lastSafetyStateRef.current === safetyKey) return;
    lastSafetyStateRef.current = safetyKey;

    if (liveSafetyDecision.status !== 'ready') {
      reachedSinceRef.current = null;
      lastLiveSpeechStepRef.current = '';
      latestLiveSpeechRef.current = null;
      clearLiveCueRetryTimer();
    }

    void saveGuidanceLogsApi([
      {
        id: `log_${Date.now()}`,
        sessionId: session.id,
        type: 'safety_state_changed',
        message: `${liveSafetyDecision.headline}. ${liveSafetyDecision.detail}`,
        timestamp: new Date().toISOString(),
        payload: {
          status: liveSafetyDecision.status,
          reasons: liveSafetyDecision.reasons,
        },
      },
    ]).catch((error) => {
      setControlError(error instanceof Error ? error.message : 'Failed to save the safety state.');
    });
  }, [clearLiveCueRetryTimer, liveSafetyDecision.detail, liveSafetyDecision.headline, liveSafetyDecision.reasons, liveSafetyDecision.status, session]);

  useEffect(() => {
    if (!session?.plannedRoute) {
      clearSafetyAnnouncementRetryTimer();
      return;
    }
    if (liveSafetyDecision.status === 'ready') {
      lastSafetyAnnouncementRef.current = '';
      clearSafetyAnnouncementRetryTimer();
      return;
    }

    const announcementKey = `${liveSafetyDecision.status}:${liveSafetyDecision.detail}`;
    if (lastSafetyAnnouncementRef.current === announcementKey) return;
    if (pendingSafetyAnnouncementRef.current === announcementKey) return;

    clearSafetyAnnouncementRetryTimer();
    pendingSafetyAnnouncementRef.current = announcementKey;

    const retryStartedAt = Date.now();
    const speakSafetyWhenCalm = () => {
      if (isSpeechPlaying()) {
        if (Date.now() - retryStartedAt < LIVE_CUE_RETRY_WINDOW_MS) {
          safetyAnnouncementRetryTimerRef.current = window.setTimeout(
            speakSafetyWhenCalm,
            LIVE_CUE_RETRY_INTERVAL_MS,
          );
          return;
        }
      }

      pendingSafetyAnnouncementRef.current = '';
      safetyAnnouncementRetryTimerRef.current = null;
      lastSafetyAnnouncementRef.current = announcementKey;
      speak(safetyPauseSpeech, { language: speechLanguage });
    };

    safetyAnnouncementRetryTimerRef.current = window.setTimeout(speakSafetyWhenCalm, 0);
  }, [
    clearSafetyAnnouncementRetryTimer,
    liveSafetyDecision.detail,
    liveSafetyDecision.status,
    safetyPauseSpeech,
    session?.plannedRoute,
    speak,
    speechLanguage,
  ]);

  const handleAdvance = useCallback(
    async (reason: 'manual' | 'auto' = 'manual') => {
      if (!session || !session.plannedRoute || syncing) return;
      if (reason === 'auto' && !liveSafetyDecision.canAutoAdvance) {
        return;
      }

      setSyncing(true);
      setControlError(null);

      try {
        const nextCueIndex = Math.min(
          guidance.cueIndex + 1,
          Math.max(0, guidance.cues.length - 1),
        );
        const nextTarget = liveRoutePlan?.holds[nextCueIndex] ?? session.plannedRoute.holds[nextCueIndex] ?? liveCurrentHold;

        const nextSession = await updateClimbSessionApi(session.id, {
          cueIndex: nextCueIndex,
          currentTargetHoldId: nextTarget?.id || session.currentTargetHoldId,
          status: 'guiding',
          summaryStats: {
            ...session.summaryStats,
            holdsReached: Math.max(session.summaryStats.holdsReached, nextCueIndex),
            cueCount: session.summaryStats.cueCount + 1,
          },
        });

        setSession(nextSession);

        await saveGuidanceLogsApi([
          {
            id: `log_${Date.now()}`,
            sessionId: nextSession.id,
            type: 'hold_reached',
            message:
              reason === 'auto'
                ? `Pose tracker confirmed ${liveCurrentHold?.label || 'the current hold'}.`
                : `Reached guidance step ${nextCueIndex + 1}.`,
            timestamp: new Date().toISOString(),
            payload: {
              cueIndex: nextCueIndex,
              holdId: liveCurrentHold?.id || nextSession.currentTargetHoldId,
              reason,
            },
          },
        ]);

        latestLiveSpeechRef.current = null;
        clearLiveCueRetryTimer();
        if (reason === 'manual' && nextTarget) {
          const nextDistancePct = getNearestLimbDistancePct(livePoseState, nextTarget);
          const nextSpeech = language === 'zh'
            ? buildLivePositionSpeechZh({
                targetHold: nextTarget,
                activeAnchor: chestAnchor,
                distancePct: nextDistancePct,
              }).speechText
            : buildLivePositionGuidance({
                targetHold: nextTarget,
                activeAnchor: chestAnchor,
                distancePct: nextDistancePct,
              }).speechText;

          if (nextSpeech) {
            lastLiveSpeechStepRef.current = `${nextCueIndex}:${nextTarget.id}`;
            lastLiveSpeechAtRef.current = Date.now();
            void speak(nextSpeech, { language: speechLanguage });
          } else {
            lastLiveSpeechStepRef.current = '';
            lastLiveSpeechAtRef.current = 0;
          }
        } else {
          lastLiveSpeechStepRef.current = '';
          lastLiveSpeechAtRef.current = 0;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to advance the live guidance cue.';
        setControlError(message);
        if (reason === 'manual') {
          speakLocalized(message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [
      chestAnchor,
      clearLiveCueRetryTimer,
      guidance.cueIndex,
      guidance.cues.length,
      language,
      liveCurrentHold,
      livePoseState,
      liveRoutePlan,
      liveSafetyDecision.canAutoAdvance,
      session,
      speak,
      speakLocalized,
      speechLanguage,
      syncing,
    ],
  );

  const handleFinish = useCallback(async () => {
    if (!session || finishPendingRef.current) return;
    finishPendingRef.current = true;
    setFinishPending(true);

    const elapsedSeconds = Math.max(
      1,
      Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000),
    );
    const completedAt = new Date().toISOString();

    try {
      setControlError(null);
      const nextSession = await updateClimbSessionApi(session.id, {
        completed: true,
        elapsedSeconds,
        endedAt: completedAt,
        cueIndex: guidance.cueIndex,
        status: 'completed',
        summaryStats: {
          ...session.summaryStats,
          holdsReached: Math.max(session.summaryStats.holdsReached, guidance.cueIndex + 1),
        },
      });

      setSession(nextSession);

      await saveGuidanceLogsApi([
        {
          id: `log_${Date.now()}`,
          sessionId: nextSession.id,
          type: 'session_completed',
          message: 'Live guidance session completed.',
          timestamp: completedAt,
          payload: { elapsedSeconds },
        },
      ]);

      navigate(routes.climbSummary, { replace: true, state: { completedSession: nextSession } });
    } catch (error) {
      finishPendingRef.current = false;
      setFinishPending(false);
      const message = error instanceof Error ? error.message : 'Unable to finish the session.';
      setControlError(message);
      speakLocalized(message);
    }
  }, [guidance.cueIndex, navigate, session, speakLocalized]);

  const handleRecalibrate = useCallback(async () => {
    if (!session) return;

    try {
      setControlError(null);
      speak(
        language === 'zh'
          ? buildRecalibrationSpeechZh()
          : 'Recalibrating. Point the camera at the wall and keep three points of contact if possible.',
        { language: speechLanguage },
      );

      await recalibrate();

      await saveGuidanceLogsApi([
        {
          id: `log_${Date.now()}`,
          sessionId: session.id,
          type: 'recalibrate',
          message: 'Manual recalibration requested by the climber.',
          timestamp: new Date().toISOString(),
          payload: { cueIndex: guidance.cueIndex },
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Recalibration failed.';
      setControlError(message);
      speakLocalized(message);
    }
  }, [guidance.cueIndex, language, recalibrate, session, speak, speechLanguage, speakLocalized]);

  useEffect(() => {
    if (
      !liveSafetyDecision.canAutoAdvance ||
      reachDistancePct === null ||
      !liveCurrentHold ||
      syncing ||
      livePoseState.poseQualityPct < 45 ||
      livePoseState.visibleLimbCount < 1
    ) {
      reachedSinceRef.current = null;
      return;
    }

    const withinThreshold = reachDistancePct <= targetThreshold;
    if (!withinThreshold) {
      reachedSinceRef.current = null;
      return;
    }

    const now = Date.now();

    if (reachedSinceRef.current === null) {
      reachedSinceRef.current = now;
      return;
    }

    if (
      now - reachedSinceRef.current >= 700 &&
      now - lastAutoAdvanceRef.current >= 2200 &&
      !guidance.isLastCue
    ) {
      lastAutoAdvanceRef.current = now;
      reachedSinceRef.current = null;
      void handleAdvance('auto');
    }
  }, [
    guidance.isLastCue,
    handleAdvance,
    liveCurrentHold,
    livePoseState.poseQualityPct,
    livePoseState.visibleLimbCount,
    syncing,
    reachDistancePct,
    targetThreshold,
    liveSafetyDecision.canAutoAdvance,
  ]);

  useEffect(() => {
    if (!liveSafetyDecision.canPlayProximityCue) return;
    if (reachDistancePct === null) return;
    if (isSpeechPlaying()) return;

    const now = Date.now();
    if (now - lastBeepRef.current < 1100) return;
    if (reachDistancePct > targetThreshold * 2.1) return;

    lastBeepRef.current = now;
    const frequency =
      reachDistancePct <= targetThreshold
        ? 1080
        : reachDistancePct <= targetThreshold * 1.4
          ? 880
          : 680;

    void playProximityBeep(frequency, 80, 0.03);
  }, [liveSafetyDecision.canPlayProximityCue, reachDistancePct, targetThreshold]);

  useEffect(() => {
    if (!liveSafetyDecision.canSpeakLiveCue) {
      latestLiveSpeechRef.current = null;
      clearLiveCueRetryTimer();
      return;
    }
    if (!guidance.currentCue || !liveCurrentHold || !livePositionSpeechText) {
      latestLiveSpeechRef.current = null;
      clearLiveCueRetryTimer();
      return;
    }
    if (!livePoseState.active && nearestLimbDistancePct === null) {
      latestLiveSpeechRef.current = null;
      clearLiveCueRetryTimer();
      return;
    }
    if (livePoseState.poseQualityPct <= 0 && nearestLimbDistancePct === null) {
      latestLiveSpeechRef.current = null;
      clearLiveCueRetryTimer();
      return;
    }

    const now = Date.now();
    const stepKey = `${guidance.cueIndex}:${liveCurrentHold.id}`;
    const isNewStep = lastLiveSpeechStepRef.current !== stepKey;
    const closeToTarget = nearestLimbDistancePct !== null && nearestLimbDistancePct <= targetThreshold * 1.35;
    const minSpacing = isNewStep ? 0 : closeToTarget ? LIVE_CUE_CLOSE_SPACING_MS : LIVE_CUE_DEFAULT_SPACING_MS;

    latestLiveSpeechRef.current = {
      stepKey,
      speechText: livePositionSpeechText,
      language: speechLanguage,
    };

    if (!isNewStep && now - lastLiveSpeechAtRef.current < minSpacing) {
      return;
    }

    if (pendingLiveSpeechStepRef.current === stepKey) {
      return;
    }

    clearLiveCueRetryTimer();
    pendingLiveSpeechStepRef.current = stepKey;

    const retryStartedAt = now;
    const speakWhenCalm = () => {
      const latestLiveSpeech = latestLiveSpeechRef.current;
      if (!latestLiveSpeech || latestLiveSpeech.stepKey !== stepKey) {
        if (pendingLiveSpeechStepRef.current === stepKey) {
          pendingLiveSpeechStepRef.current = '';
        }
        return;
      }

      if (isSpeechPlaying()) {
        if (Date.now() - retryStartedAt < LIVE_CUE_RETRY_WINDOW_MS) {
          liveCueRetryTimerRef.current = window.setTimeout(speakWhenCalm, LIVE_CUE_RETRY_INTERVAL_MS);
          return;
        }
      }

      lastLiveSpeechStepRef.current = stepKey;
      pendingLiveSpeechStepRef.current = '';
      liveCueRetryTimerRef.current = null;
      lastLiveSpeechAtRef.current = Date.now();
      speak(latestLiveSpeech.speechText, { language: latestLiveSpeech.language });
    };

    liveCueRetryTimerRef.current = window.setTimeout(
      speakWhenCalm,
      isNewStep ? INITIAL_LIVE_CUE_DELAY_MS : 0,
    );
  }, [
    clearLiveCueRetryTimer,
    guidance.cueIndex,
    guidance.currentCue,
    liveCurrentHold,
    livePositionSpeechText,
    livePoseState.active,
    livePoseState.poseQualityPct,
    nearestLimbDistancePct,
    speak,
    speechLanguage,
    targetThreshold,
    liveSafetyDecision.canSpeakLiveCue,
  ]);

  if (loadingLiveData) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Preparing live guidance')}
          message={t('The monkey is checking the route before live guidance starts.')}
        />
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Live guidance')}
          message={localizeAssistText(loadError, language)}
        />
      </section>
    );
  }

  if (!session?.plannedRoute) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Preparing live guidance')}
          message={t('The monkey is checking the route before live guidance starts.')}
        />
      </section>
    );
  }

  return (
    <div className="stack-lg assist-guidance-shell assist-live-page">
      <Card
        title={t('Live guidance camera')}
        className="assist-live-camera-card"
        bodyClassName="stack-md"
      >
        <CameraPreview
          stream={stream}
          label={t('Live climbing camera for pose-guided next-hold alignment')}
          videoRef={videoRef}
          onVideoReady={setVideoElement}
          className="assist-live-camera-preview"
          plainLiveView
          syncAspectRatio
          fixedAspectRatio="3 / 4"
          fallbackAspectRatio="3 / 4"
        >
          <LiveGuidanceOverlay
            wallMap={scan?.wallMap}
            routePlan={liveRoutePlan}
            currentHold={liveCurrentHold}
            completedHoldIds={completedHoldIds}
            poseState={livePoseState}
            activeLimb={guidance.currentCue?.limb}
          />
        </CameraPreview>

        <div className="assist-live-telemetry">
          <div>
            <span className="badge">{t('Tracker')}</span>
            <p className="subtle-text">
              {trackerStatusText}
            </p>
          </div>
          <div>
            <span className="badge">{t('Target')}</span>
            <p className="subtle-text">
              {formatHoldTarget(liveCurrentHold, language)}
            </p>
          </div>
          <div>
            <span className="badge">{t('Alignment')}</span>
            <p className="subtle-text">
              {typeof alignmentPct === 'number'
                ? `${alignmentPct}%`
                : localizeAssistText('Waiting for the active limb', language)}
            </p>
          </div>
          <div>
            <span className="badge">{t('Wall lock')}</span>
            <p className="subtle-text">
              {formatAlignmentStatus(alignmentState, language)}
            </p>
          </div>
          <div>
            <span className="badge">{t('Safety')}</span>
            <p className="subtle-text">
              {safetyStatusText}
            </p>
          </div>
        </div>
      </Card>

      <VoiceCuePanel
        cue={localizedPanelCue}
        progressLabel={guidance.currentCue?.progressLabel}
        isSpeaking={isSpeaking}
        onSpeak={() =>
          speak(liveSafetyDecision.status === 'ready' ? manualCue : safetyPauseSpeech, { language: speechLanguage })
        }
        onRepeat={() =>
          (liveSafetyDecision.status === 'ready'
            ? repeatWithOptions({ language: speechLanguage })
            : speak(safetyPauseSpeech, { language: speechLanguage }))
        }
        onAdvance={() => void handleAdvance('manual')}
        onNext={() => void handleAdvance('manual')}
        onRecalibrate={() => void handleRecalibrate()}
        onFinish={() => void handleFinish()}
        finishDisabled={finishPending}
      />
    </div>
  );
}
