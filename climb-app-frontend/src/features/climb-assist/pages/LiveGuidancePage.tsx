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
import { isSpeechPlaying } from '../../../shared/lib/speech';
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
  buildGuidanceCueSpeechZh,
  buildLivePositionSpeechZh,
  buildLiveSafetyPauseSpeechZh,
  buildPoseTrackerStatus,
  buildRecalibrationSpeechZh,
  buildTargetReachedSpeechZh,
} from '../services/liveGuidanceSpeech.service';
import { limbToPoseJointName } from '../services/poseTracker.service';
import { buildLiveGuidanceSafetyDecision } from '../services/safetyState.service';
import {
  formatAlignmentStatus,
  formatHoldTarget,
  localizeAssistText,
} from '../utils/localizedAssistText';

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

function getDistancePct(anchor: { xPct: number; yPct: number } | undefined, hold: Hold | null) {
  if (!anchor || !hold) return null;
  const dx = anchor.xPct - hold.xPct;
  const dy = anchor.yPct - hold.yPct;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTargetThreshold(hold: Hold | null, limb?: GuidanceLimb) {
  if (!hold) return 7;
  const base = Math.max(2.8, (hold.radiusPct ?? 3.2) * 0.9) + (isFootLimb(limb) ? 4.4 : 3.6);
  return Number(base.toFixed(2));
}

const PRIMARY_CUE_RETRY_DELAY_MS = 650;
const PRIMARY_CUE_MAX_RETRIES = 2;

function buildPrimaryCueKey(cueIndex: number, holdId: string | undefined, speechText: string) {
  return `${cueIndex}:${holdId || 'unknown'}:${speechText}`;
}

function buildTargetReachedSpeechEn(nextCue: string) {
  return nextCue ? `Target reached. ${nextCue}` : 'Target reached. Continue to the next step.';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [primaryCueRetryNonce, setPrimaryCueRetryNonce] = useState(0);

  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const guidance = useGuidanceEngine(session?.plannedRoute, session?.cueIndex ?? 0);
  const poseState = useLivePoseTracker(videoElement, Boolean(stream && session?.plannedRoute));

  const lastCueSpokenRef = useRef('');
  const lastPrimaryCueAtRef = useRef(0);
  const lastLiveSpeechKeyRef = useRef('');
  const lastLiveSpeechAtRef = useRef(0);
  const reachedSinceRef = useRef<number | null>(null);
  const lastAutoAdvanceRef = useRef(0);
  const lastBeepRef = useRef(0);
  const lastSafetyStateRef = useRef('');
  const lastSafetyAnnouncementRef = useRef('');
  const primaryCuePendingRef = useRef('');
  const primaryCueRetryTimerRef = useRef<number | null>(null);
  const primaryCueRetryKeyRef = useRef('');
  const primaryCueRetryCountRef = useRef(0);
  const queuedPrimaryCueSpeechRef = useRef<{ cueKey: string; speech: string } | null>(null);

  usePageTitle('Live guidance');

  const speakLocalized = useCallback((text: string, languageOverride?: 'ZH' | 'EN') => {
    const localizedText = language === 'zh' ? localizeAssistText(text, language) : text;
    speak(localizedText, { language: languageOverride ?? speechLanguage });
  }, [language, speak, speechLanguage]);

  useEffect(() => {
    warm(speechLanguage);
  }, [speechLanguage, warm]);

  useEffect(
    () => () => {
      if (primaryCueRetryTimerRef.current !== null) {
        window.clearTimeout(primaryCueRetryTimerRef.current);
      }
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

  const activeAnchor = useMemo(
    () => getCueAnchor(guidance.currentCue?.limb, poseState),
    [guidance.currentCue?.limb, poseState],
  );

  const distancePct = useMemo(
    () => getDistancePct(activeAnchor, liveCurrentHold),
    [activeAnchor, liveCurrentHold],
  );

  const targetThreshold = useMemo(
    () => getTargetThreshold(liveCurrentHold, guidance.currentCue?.limb),
    [guidance.currentCue?.limb, liveCurrentHold],
  );

  const alignmentPct = useMemo(() => {
    if (distancePct === null) return undefined;
    return Math.max(0, Math.min(100, Math.round(100 - distancePct * 6)));
  }, [distancePct]);

  const liveSafetyDecision = useMemo(
    () => buildLiveGuidanceSafetyDecision({ scan, poseState, alignmentState }),
    [alignmentState, poseState, scan],
  );

  const cue = useMemo(
    () => guidance.currentCue?.message ?? 'No cue available',
    [guidance.currentCue],
  );

  const livePositionGuidance = useMemo(
    () =>
      buildLivePositionGuidance({
        limb: guidance.currentCue?.limb,
        targetHold: liveCurrentHold,
        activeAnchor,
        poseFrame: poseState.poseFrame,
        distancePct,
        targetThreshold,
      }),
    [activeAnchor, distancePct, guidance.currentCue?.limb, liveCurrentHold, poseState.poseFrame, targetThreshold],
  );

  const livePositionSpeechZh = useMemo(
    () =>
      buildLivePositionSpeechZh({
        limb: guidance.currentCue?.limb,
        targetHold: liveCurrentHold,
        activeAnchor,
        distancePct,
        targetThreshold,
      }),
    [activeAnchor, distancePct, guidance.currentCue?.limb, liveCurrentHold, targetThreshold],
  );

  const trackerHint = useMemo(() => livePositionGuidance.displayText, [livePositionGuidance.displayText]);

  const spokenCueZh = useMemo(
    () =>
      guidance.currentCue
        ? buildGuidanceCueSpeechZh({
            cueIndex: guidance.cueIndex,
            totalCues: guidance.cues.length,
            cue: guidance.currentCue,
            targetHold: liveCurrentHold,
          })
        : '',
    [guidance.cueIndex, guidance.cues.length, guidance.currentCue, liveCurrentHold],
  );

  const manualCueZh = useMemo(() => {
    const combinedCue = [spokenCueZh, livePositionSpeechZh.speechText].filter(Boolean).join(' ');
    return combinedCue || spokenCueZh;
  }, [livePositionSpeechZh.speechText, spokenCueZh]);

  const safetyPauseSpeechZh = useMemo(
    () =>
      buildLiveSafetyPauseSpeechZh({
        decision: liveSafetyDecision,
        poseState,
        alignmentState,
        scan,
      }),
    [alignmentState, liveSafetyDecision, poseState, scan],
  );

  const trackerStatus = useMemo(() => buildPoseTrackerStatus(poseState, language), [language, poseState]);
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
  const displayPrimaryCue = language === 'zh'
    ? spokenCueZh || t('No cue available')
    : cue;
  const displayTrackerHint = language === 'zh'
    ? livePositionSpeechZh.speechText ?? localizeAssistText(trackerHint, language)
    : trackerHint;
  const displayPanelCue = controlError
    ? localizeAssistText(controlError, language)
    : liveSafetyDecision.status === 'ready'
      ? [displayPrimaryCue, displayTrackerHint].filter(Boolean).join(' ')
      : language === 'zh'
        ? safetyPauseSpeechZh
        : localizedSafetyDetail;
  const localizedPanelCue = language === 'zh'
    ? localizeAssistText(displayPanelCue, language)
    : displayPanelCue;
  const manualCue = language === 'zh'
    ? manualCueZh
    : [displayPrimaryCue, displayTrackerHint].filter(Boolean).join(' ');
  const safetyPauseSpeech = language === 'zh' ? safetyPauseSpeechZh : localizedSafetyDetail;
  const livePositionSpeechText = language === 'zh'
    ? livePositionSpeechZh.speechText
    : livePositionGuidance.speechText;
  const livePositionSpeechKey = language === 'zh'
    ? livePositionSpeechZh.speechKey
    : livePositionGuidance.speechKey;

  const completedHoldIds = useMemo(
    () => session?.plannedRoute?.holds.slice(0, guidance.cueIndex).map((hold) => hold.id) ?? [],
    [guidance.cueIndex, session?.plannedRoute?.holds],
  );

  useEffect(() => {
    if (!guidance.currentCue || liveSafetyDecision.status !== 'ready') return;
    const primaryCueSpeech = language === 'zh' ? spokenCueZh : displayPrimaryCue;
    const cueKey = buildPrimaryCueKey(guidance.cueIndex, guidance.currentCue.holdId, primaryCueSpeech);
    const queuedPrimaryCueSpeech =
      queuedPrimaryCueSpeechRef.current?.cueKey === cueKey
        ? queuedPrimaryCueSpeechRef.current.speech
        : primaryCueSpeech;

    if (!queuedPrimaryCueSpeech) return;
    if (lastCueSpokenRef.current === cueKey || primaryCuePendingRef.current === cueKey) return;

    if (primaryCueRetryKeyRef.current !== cueKey) {
      if (primaryCueRetryTimerRef.current !== null) {
        window.clearTimeout(primaryCueRetryTimerRef.current);
        primaryCueRetryTimerRef.current = null;
      }

      primaryCueRetryKeyRef.current = cueKey;
      primaryCueRetryCountRef.current = 0;
    }

    const isRetryAttempt = primaryCueRetryCountRef.current > 0;
    primaryCuePendingRef.current = cueKey;

    let cancelled = false;

    if (!isRetryAttempt && session) {
      void saveGuidanceLogsApi([
        {
          id: `log_${Date.now()}`,
          sessionId: session.id,
          type: 'cue_issued',
          message: guidance.currentCue.message,
          timestamp: new Date().toISOString(),
          payload: { cueIndex: guidance.cueIndex, holdId: guidance.currentCue.holdId },
        },
      ]).catch((error) => {
        setControlError(error instanceof Error ? error.message : 'Failed to save the cue log.');
      });
    }

    void speak(queuedPrimaryCueSpeech, { language: speechLanguage }).then((result) => {
      if (cancelled) return;

      if (result.played) {
        if (primaryCuePendingRef.current === cueKey) {
          primaryCuePendingRef.current = '';
        }

        lastCueSpokenRef.current = cueKey;
        lastPrimaryCueAtRef.current = Date.now();
        lastLiveSpeechKeyRef.current = '';
        lastLiveSpeechAtRef.current = 0;
        primaryCueRetryCountRef.current = 0;

        if (queuedPrimaryCueSpeechRef.current?.cueKey === cueKey) {
          queuedPrimaryCueSpeechRef.current = null;
        }

        return;
      }

      if (result.aborted || primaryCueRetryCountRef.current >= PRIMARY_CUE_MAX_RETRIES) {
        if (primaryCuePendingRef.current === cueKey) {
          primaryCuePendingRef.current = '';
        }

        return;
      }

      primaryCueRetryCountRef.current += 1;
      primaryCueRetryTimerRef.current = window.setTimeout(() => {
        primaryCueRetryTimerRef.current = null;

        if (primaryCuePendingRef.current === cueKey) {
          primaryCuePendingRef.current = '';
        }

        if (primaryCueRetryKeyRef.current === cueKey && lastCueSpokenRef.current !== cueKey) {
          setPrimaryCueRetryNonce((value) => value + 1);
        }
      }, PRIMARY_CUE_RETRY_DELAY_MS);
    });

    return () => {
      cancelled = true;

      if (primaryCuePendingRef.current === cueKey) {
        primaryCuePendingRef.current = '';
      }
    };
  }, [displayPrimaryCue, guidance.cueIndex, guidance.currentCue, language, liveSafetyDecision.status, primaryCueRetryNonce, session, speak, speechLanguage, spokenCueZh]);

  useEffect(() => {
    if (!session) return;

    const safetyKey = `${liveSafetyDecision.status}:${liveSafetyDecision.detail}`;
    if (lastSafetyStateRef.current === safetyKey) return;
    lastSafetyStateRef.current = safetyKey;

    if (liveSafetyDecision.status !== 'ready') {
      if (primaryCueRetryTimerRef.current !== null) {
        window.clearTimeout(primaryCueRetryTimerRef.current);
        primaryCueRetryTimerRef.current = null;
      }

      primaryCuePendingRef.current = '';
      primaryCueRetryKeyRef.current = '';
      primaryCueRetryCountRef.current = 0;
      reachedSinceRef.current = null;
      lastLiveSpeechKeyRef.current = '';
      lastCueSpokenRef.current = '';
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
  }, [liveSafetyDecision.detail, liveSafetyDecision.headline, liveSafetyDecision.reasons, liveSafetyDecision.status, session]);

  useEffect(() => {
    if (!session?.plannedRoute) return;
    if (liveSafetyDecision.status === 'ready') {
      lastSafetyAnnouncementRef.current = '';
      return;
    }

    const announcementKey = `${liveSafetyDecision.status}:${liveSafetyDecision.detail}`;
    if (lastSafetyAnnouncementRef.current === announcementKey) return;

    if (Date.now() - lastPrimaryCueAtRef.current < 1000) {
      return;
    }

    if (isSpeechPlaying()) {
      return;
    }

    lastSafetyAnnouncementRef.current = announcementKey;
    speak(safetyPauseSpeech, { language: speechLanguage });
  }, [liveSafetyDecision.detail, liveSafetyDecision.status, safetyPauseSpeech, session?.plannedRoute, speak, speechLanguage]);

  const handleAdvance = useCallback(
    async (reason: 'manual' | 'auto' = 'manual') => {
      if (!session || !session.plannedRoute || syncing) return;
      if (!liveSafetyDecision.canAutoAdvance) {
        if (reason === 'manual') {
          setControlError(liveSafetyDecision.detail);
          speak(safetyPauseSpeech, { language: speechLanguage });
        }
        return;
      }

      setSyncing(true);
      setControlError(null);

      try {
        const nextCueIndex = Math.min(
          guidance.cueIndex + 1,
          Math.max(0, guidance.cues.length - 1),
        );
        const nextTarget = session.plannedRoute.holds[nextCueIndex] ?? liveCurrentHold;
        const nextCue = guidance.cues[nextCueIndex];
        const nextPrimaryCueSpeech = nextCue
          ? buildGuidanceCueSpeechZh({
              cueIndex: nextCueIndex,
              totalCues: guidance.cues.length,
              cue: nextCue,
              targetHold: nextTarget,
            })
          : '';
        const nextCueKey = nextCue
          ? buildPrimaryCueKey(nextCueIndex, nextCue.holdId, nextPrimaryCueSpeech)
          : '';

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

        if (primaryCueRetryTimerRef.current !== null) {
          window.clearTimeout(primaryCueRetryTimerRef.current);
          primaryCueRetryTimerRef.current = null;
        }

        primaryCuePendingRef.current = '';
        primaryCueRetryKeyRef.current = '';
        primaryCueRetryCountRef.current = 0;
        queuedPrimaryCueSpeechRef.current = null;

        if (reason === 'auto' && nextTarget && nextCue && nextCueKey) {
          queuedPrimaryCueSpeechRef.current = {
            cueKey: nextCueKey,
            speech: language === 'zh'
              ? buildTargetReachedSpeechZh({
                  nextCueIndex,
                  totalCues: guidance.cues.length,
                  nextCue,
                  nextHold: nextTarget,
                })
              : buildTargetReachedSpeechEn(nextCue.message),
          };
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
    [guidance.cueIndex, guidance.cues, language, liveCurrentHold, liveSafetyDecision.canAutoAdvance, liveSafetyDecision.detail, safetyPauseSpeech, session, speakLocalized, speechLanguage, syncing],
  );

  const handleFinish = useCallback(async () => {
    if (!session) return;

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

      navigate(routes.climbSummary);
    } catch (error) {
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
      distancePct === null ||
      !liveCurrentHold ||
      syncing ||
      poseState.poseQualityPct < 45 ||
      poseState.visibleLimbCount < 1
    ) {
      reachedSinceRef.current = null;
      return;
    }

    const withinThreshold = distancePct <= targetThreshold;
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
    distancePct,
    guidance.isLastCue,
    handleAdvance,
    liveCurrentHold,
    poseState.poseQualityPct,
    poseState.visibleLimbCount,
    syncing,
    targetThreshold,
    liveSafetyDecision.canAutoAdvance,
  ]);

  useEffect(() => {
    if (!liveSafetyDecision.canPlayProximityCue) return;
    if (distancePct === null) return;
    if (primaryCuePendingRef.current) return;
    if (isSpeechPlaying()) return;

    const now = Date.now();
    if (now - lastBeepRef.current < 1100) return;
    if (distancePct > targetThreshold * 2.1) return;

    lastBeepRef.current = now;
    const frequency =
      distancePct <= targetThreshold
        ? 1080
        : distancePct <= targetThreshold * 1.4
          ? 880
          : 680;

    void playProximityBeep(frequency, 80, 0.03);
  }, [distancePct, liveSafetyDecision.canPlayProximityCue, targetThreshold]);

  useEffect(() => {
    if (!liveSafetyDecision.canSpeakLiveCue) return;
    if (!guidance.currentCue || !liveCurrentHold || !livePositionSpeechText) return;
    if (!poseState.active && distancePct === null) return;
    if (poseState.poseQualityPct <= 0 && distancePct === null) return;
    if (primaryCuePendingRef.current) return;

    const now = Date.now();
    const minSpacing = distancePct !== null && distancePct <= targetThreshold * 1.3 ? 1100 : 1700;
    const isNewSpeechKey = lastLiveSpeechKeyRef.current !== livePositionSpeechKey;

    if (!isNewSpeechKey && now - lastLiveSpeechAtRef.current < minSpacing) {
      return;
    }

    if (now - lastPrimaryCueAtRef.current < 850) {
      return;
    }

    if (isSpeechPlaying()) {
      return;
    }

    lastLiveSpeechKeyRef.current = livePositionSpeechKey;
    lastLiveSpeechAtRef.current = now;
    speak(livePositionSpeechText, { language: speechLanguage });
  }, [
    distancePct,
    guidance.currentCue,
    guidance.isLastCue,
    liveCurrentHold,
    livePositionSpeechKey,
    livePositionSpeechText,
    poseState.active,
    poseState.poseQualityPct,
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
            poseState={poseState}
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
      />
    </div>
  );
}
