import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
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
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { playProximityBeep } from '../../../shared/lib/audioCue';
import type { ClimbScan, ClimbSession, GuidanceLimb, Hold } from '../../../shared/types/climb';
import CameraPreview from '../components/CameraPreview';
import LiveGuidanceOverlay from '../components/LiveGuidanceOverlay';
import PositionHintCard from '../components/PositionHintCard';
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
  buildPoseTrackerStatusZh,
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

export default function LiveGuidancePage() {
  const { speak, repeatWithOptions, warm } = useSpeech();
  const { stream, supported: cameraSupported, requestAccess } = useCamera();
  const { announce } = useAccessibility();
  const { language, t } = useLanguage();
  const [session, setSession] = useState<ClimbSession | null>(null);
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [loadingLiveData, setLoadingLiveData] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

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
  const lastScreenReaderSummaryRef = useRef('');
  const liveSummaryRef = useRef<HTMLDivElement | null>(null);
  const speechLanguage = language === 'zh' ? 'ZH' : 'EN';

  usePageTitle('Live guidance');

  useEffect(() => {
    warm('ZH');
  }, [warm]);

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
    void requestAccess();
  }, [cameraSupported, requestAccess, stream]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setIsSpeaking(window.speechSynthesis.speaking);
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

  const trackerStatusZh = useMemo(() => buildPoseTrackerStatusZh(poseState), [poseState]);
  const localizedSafetyHeadline = localizeAssistText(liveSafetyDecision.headline, language);
  const localizedSafetyDetail = localizeAssistText(liveSafetyDecision.detail, language);
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
      : localizedSafetyDetail;
  const blindPrioritySummary = [
    `${t('Current cue')}: ${displayPanelCue}`,
    `${t('Target')}: ${formatHoldTarget(liveCurrentHold, language)}`,
    `${t('Safety')}: ${localizedSafetyHeadline}. ${localizedSafetyDetail}`,
    `${t('Tracker')}: ${controlError ? localizeAssistText(controlError, language) : `${trackerStatusZh.headline}. ${trackerStatusZh.detail}`}`,
    typeof alignmentPct === 'number' ? `${t('Alignment')}: ${alignmentPct}%` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const completedHoldIds = useMemo(
    () => session?.plannedRoute?.holds.slice(0, guidance.cueIndex).map((hold) => hold.id) ?? [],
    [guidance.cueIndex, session?.plannedRoute?.holds],
  );

  useEffect(() => {
    if (!guidance.currentCue || liveSafetyDecision.status !== 'ready') return;
    const spokenGuideCue = spokenCueZh;

    if (lastCueSpokenRef.current === spokenGuideCue) return;

    lastCueSpokenRef.current = spokenGuideCue;
    lastPrimaryCueAtRef.current = Date.now();
    lastLiveSpeechKeyRef.current = '';
    lastLiveSpeechAtRef.current = 0;
    speak(spokenGuideCue, { language: 'ZH' });

    if (session) {
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
  }, [guidance.cueIndex, guidance.currentCue, liveSafetyDecision.status, session, speak, spokenCueZh]);

  useEffect(() => {
    if (!session) return;

    const safetyKey = `${liveSafetyDecision.status}:${liveSafetyDecision.detail}`;
    if (lastSafetyStateRef.current === safetyKey) return;
    lastSafetyStateRef.current = safetyKey;

    if (liveSafetyDecision.status !== 'ready') {
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

    if (Date.now() - lastPrimaryCueAtRef.current < 1400) {
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      return;
    }

    lastSafetyAnnouncementRef.current = announcementKey;
    speak(safetyPauseSpeechZh, { language: 'ZH' });
  }, [liveSafetyDecision.detail, liveSafetyDecision.status, safetyPauseSpeechZh, session?.plannedRoute, speak]);

  useEffect(() => {
    if (!session?.plannedRoute) return;

    const focusTimer = window.setTimeout(() => {
      liveSummaryRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(focusTimer);
  }, [session?.id]);

  useEffect(() => {
    if (!session?.plannedRoute) return;

    const summaryKey = `${guidance.cueIndex}:${liveSafetyDecision.status}:${controlError ?? ''}:${displayPrimaryCue}:${liveCurrentHold?.id ?? ''}`;
    if (lastScreenReaderSummaryRef.current === summaryKey) return;

    lastScreenReaderSummaryRef.current = summaryKey;
    announce(blindPrioritySummary);
  }, [announce, blindPrioritySummary, controlError, displayPrimaryCue, guidance.cueIndex, liveCurrentHold?.id, liveSafetyDecision.status, session?.plannedRoute]);

  const handleAdvance = useCallback(
    async (reason: 'manual' | 'auto' = 'manual') => {
      if (!session || !session.plannedRoute || syncing) return;
      if (!liveSafetyDecision.canAutoAdvance) {
        if (reason === 'manual') {
          setControlError(liveSafetyDecision.detail);
          speak(safetyPauseSpeechZh, { language: 'ZH' });
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

        if (reason === 'auto' && nextTarget) {
          speak(
            buildTargetReachedSpeechZh({
              nextCueIndex,
              totalCues: guidance.cues.length,
              nextCue: guidance.cues[nextCueIndex],
              nextHold: nextTarget,
            }),
            { language: 'ZH' },
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to advance the live guidance cue.';
        setControlError(message);
        if (reason === 'manual') {
          speak(message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [guidance.cueIndex, guidance.cues, liveCurrentHold, liveSafetyDecision.canAutoAdvance, liveSafetyDecision.detail, safetyPauseSpeechZh, session, speak, syncing],
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
      speak(message);
    }
  }, [guidance.cueIndex, navigate, session]);

  const handleRecalibrate = useCallback(async () => {
    if (!session) return;

    try {
      setControlError(null);
      speak(buildRecalibrationSpeechZh(), { language: 'ZH' });

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
      speak(message);
    }
  }, [guidance.cueIndex, recalibrate, session, speak]);

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
    if (!guidance.currentCue || !liveCurrentHold || !livePositionSpeechZh.speechText) return;
    if (!poseState.active && distancePct === null) return;
    if (poseState.poseQualityPct <= 0 && distancePct === null) return;

    const now = Date.now();
    const withinLockRange = distancePct !== null && distancePct <= targetThreshold * 0.72;
    if (withinLockRange && !guidance.isLastCue) {
      return;
    }

    const minSpacing = distancePct !== null && distancePct <= targetThreshold * 1.3 ? 1400 : 2400;
    const isNewSpeechKey = lastLiveSpeechKeyRef.current !== livePositionSpeechZh.speechKey;

    if (!isNewSpeechKey && now - lastLiveSpeechAtRef.current < minSpacing) {
      return;
    }

    if (now - lastPrimaryCueAtRef.current < 1200) {
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      return;
    }

    lastLiveSpeechKeyRef.current = livePositionSpeechZh.speechKey;
    lastLiveSpeechAtRef.current = now;
    speak(livePositionSpeechZh.speechText, { language: 'ZH' });
  }, [
    distancePct,
    guidance.currentCue,
    guidance.isLastCue,
    liveCurrentHold,
    livePositionSpeechZh.speechKey,
    livePositionSpeechZh.speechText,
    poseState.active,
    poseState.poseQualityPct,
    speak,
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
        title={t('Blind-first live summary')}
        className="assist-live-summary-card"
        bodyClassName="stack-md"
      >
        <div
          ref={liveSummaryRef}
          className="assist-screen-summary"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
        >
          <strong>{t('Current cue')} {guidance.currentCue?.progressLabel ?? ''}</strong>
          <p>{displayPanelCue}</p>
          <div className="assist-screen-summary-list">
            <p className="subtle-text">{t('Target')}: {formatHoldTarget(liveCurrentHold, language)}</p>
            <p className="subtle-text">{t('Safety')}: {localizedSafetyHeadline}. {localizedSafetyDetail}</p>
            <p className="subtle-text">
              {t('Tracker')}: {controlError ? localizeAssistText(controlError, language) : `${trackerStatusZh.headline}. ${trackerStatusZh.detail}`}
            </p>
            {typeof alignmentPct === 'number' ? <p className="subtle-text">{t('Alignment')}: {alignmentPct}%</p> : null}
          </div>
        </div>
        <p className="assist-screen-reader-note">
          <strong>{t('Blind-first controls')}</strong>
          <span>{t('This page speaks the next cue automatically. Use Reached hold after touching the target hold, and Need recalibration if the tracker drifts.')}</span>
        </p>
        <div className="inline-actions wrap assist-screen-summary-actions">
          <Button variant="secondary" onClick={() => speak(blindPrioritySummary, { language: speechLanguage })}>
            {t('Repeat live summary')}
          </Button>
        </div>
      </Card>

      <PositionHintCard
        cue={displayPrimaryCue}
        targetLabel={formatHoldTarget(liveCurrentHold, language)}
        progressLabel={guidance.currentCue?.progressLabel}
        isSpeaking={isSpeaking}
        poseStatus={liveSafetyDecision.status === 'ready' ? displayTrackerHint : localizedSafetyDetail}
        alignmentPct={alignmentPct}
      />

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
              {controlError ? localizeAssistText(controlError, language) : `${trackerStatusZh.headline}. ${trackerStatusZh.detail}`}
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
              {localizedSafetyHeadline}. {localizedSafetyDetail}
            </p>
          </div>
        </div>
      </Card>

      <VoiceCuePanel
        cue={displayPanelCue}
        progressLabel={guidance.currentCue?.progressLabel}
        isSpeaking={isSpeaking}
        onSpeak={() =>
          speak(liveSafetyDecision.status === 'ready' ? manualCueZh : safetyPauseSpeechZh, { language: 'ZH' })
        }
        onRepeat={() =>
          (liveSafetyDecision.status === 'ready'
            ? repeatWithOptions({ language: 'ZH' })
            : speak(safetyPauseSpeechZh, { language: 'ZH' }))
        }
        onAdvance={() => void handleAdvance('manual')}
        onNext={() => void handleAdvance('manual')}
        onRecalibrate={() => void handleRecalibrate()}
        onFinish={() => void handleFinish()}
      />
    </div>
  );
}
