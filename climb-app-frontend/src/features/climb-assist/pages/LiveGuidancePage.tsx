import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { useCamera } from '../../../app/providers/CameraProvider';
import {
  getClimbSessionApi,
  getLatestClimbScanApi,
  saveGuidanceLogsApi,
  updateClimbSessionApi,
} from '../../../shared/api/climbing.api';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { playProximityBeep } from '../../../shared/lib/audioCue';
import { buildCueLabel } from '../../../shared/utils/routeVoiceText';
import type { ClimbScan, ClimbSession, GuidanceLimb, Hold } from '../../../shared/types/climb';
import CameraPreview from '../components/CameraPreview';
import EncouragementBanner from '../components/EncouragementBanner';
import LiveGuidanceOverlay from '../components/LiveGuidanceOverlay';
import PositionHintCard from '../components/PositionHintCard';
import VoiceCuePanel from '../components/VoiceCuePanel';
import { useGuidanceEngine } from '../hooks/useGuidanceEngine';
import { useLivePoseTracker } from '../hooks/useLivePoseTracker';
import { useLiveWallAlignment } from '../hooks/useLiveWallAlignment';
import { buildLivePositionGuidance } from '../services/cueGenerator.service';
import { limbToPoseJointName } from '../services/poseTracker.service';
import { buildLiveGuidanceSafetyDecision } from '../services/safetyState.service';

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
  const { speak, repeat } = useSpeech();
  const { stream, supported: cameraSupported, requestAccess } = useCamera();
  const [session, setSession] = useState<ClimbSession | null>(null);
  const [scan, setScan] = useState<ClimbScan | null>(null);
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

  usePageTitle('Live guidance');

  useEffect(() => {
    Promise.all([getClimbSessionApi(), getLatestClimbScanApi()]).then(
      ([activeSession, latestScan]) => {
        setSession(activeSession);
        setScan(latestScan);
        setLoadError(null);
      },
    ).catch((error) => {
      setLoadError(error instanceof Error ? error.message : 'Unable to load live guidance data.');
    });
  }, []);

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

  const trackerHint = useMemo(() => livePositionGuidance.displayText, [livePositionGuidance.displayText]);

  const spokenCue = useMemo(
    () => buildCueLabel(guidance.cueIndex, guidance.cues.length, cue),
    [cue, guidance.cueIndex, guidance.cues.length],
  );

  const manualCue = useMemo(() => {
    const combinedCue = [cue, livePositionGuidance.speechText].filter(Boolean).join(' ');
    return buildCueLabel(guidance.cueIndex, guidance.cues.length, combinedCue || cue);
  }, [cue, guidance.cueIndex, guidance.cues.length, livePositionGuidance.speechText]);

  const completedHoldIds = useMemo(
    () => session?.plannedRoute?.holds.slice(0, guidance.cueIndex).map((hold) => hold.id) ?? [],
    [guidance.cueIndex, session?.plannedRoute?.holds],
  );

  useEffect(() => {
    if (!guidance.currentCue || liveSafetyDecision.status !== 'ready') return;

    const spokenGuideCue = buildCueLabel(
      guidance.cueIndex,
      guidance.cues.length,
      guidance.currentCue.message,
    );

    if (lastCueSpokenRef.current === spokenGuideCue) return;

    lastCueSpokenRef.current = spokenGuideCue;
    lastPrimaryCueAtRef.current = Date.now();
    lastLiveSpeechKeyRef.current = '';
    lastLiveSpeechAtRef.current = 0;
    speak(spokenGuideCue);

    if (session) {
      void saveGuidanceLogsApi([
        {
          id: `log_${Date.now()}`,
          sessionId: session.id,
          type: 'cue_issued',
          message: spokenGuideCue,
          timestamp: new Date().toISOString(),
          payload: { cueIndex: guidance.cueIndex, holdId: guidance.currentCue.holdId },
        },
      ]).catch((error) => {
        setControlError(error instanceof Error ? error.message : 'Failed to save the cue log.');
      });
    }
  }, [guidance.cueIndex, guidance.cues.length, guidance.currentCue, liveSafetyDecision.status, session, speak]);

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
    speak(`Safety pause. ${liveSafetyDecision.detail}`);
  }, [liveSafetyDecision.detail, liveSafetyDecision.status, session?.plannedRoute, speak]);

  const handleAdvance = useCallback(
    async (reason: 'manual' | 'auto' = 'manual') => {
      if (!session || !session.plannedRoute || syncing) return;
      if (!liveSafetyDecision.canAutoAdvance) {
        if (reason === 'manual') {
          setControlError(liveSafetyDecision.detail);
          speak(`Safety pause. ${liveSafetyDecision.detail}`);
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
            `Target reached. Next cue. ${buildCueLabel(
              nextCueIndex,
              guidance.cues.length,
              guidance.cues[nextCueIndex]?.message || '',
            )}`,
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
    [guidance.cueIndex, guidance.cues, liveCurrentHold, liveSafetyDecision.canAutoAdvance, liveSafetyDecision.detail, session, speak, syncing],
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
      speak(
        'Recalibration note. Keep the camera framing matched to the scan and pause on three points of contact.',
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
    if (!guidance.currentCue || !liveCurrentHold || !livePositionGuidance.speechText) return;
    if (!poseState.active && distancePct === null) return;
    if (poseState.poseQualityPct <= 0 && distancePct === null) return;

    const now = Date.now();
    const withinLockRange = distancePct !== null && distancePct <= targetThreshold * 0.72;
    if (withinLockRange && !guidance.isLastCue) {
      return;
    }

    const minSpacing = distancePct !== null && distancePct <= targetThreshold * 1.3 ? 1400 : 2400;
    const isNewSpeechKey = lastLiveSpeechKeyRef.current !== livePositionGuidance.speechKey;

    if (!isNewSpeechKey && now - lastLiveSpeechAtRef.current < minSpacing) {
      return;
    }

    if (now - lastPrimaryCueAtRef.current < 1200) {
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      return;
    }

    lastLiveSpeechKeyRef.current = livePositionGuidance.speechKey;
    lastLiveSpeechAtRef.current = now;
    speak(livePositionGuidance.speechText);
  }, [
    distancePct,
    guidance.currentCue,
    guidance.isLastCue,
    liveCurrentHold,
    livePositionGuidance.speechKey,
    livePositionGuidance.speechText,
    poseState.active,
    poseState.poseQualityPct,
    speak,
    targetThreshold,
    liveSafetyDecision.canSpeakLiveCue,
  ]);

  if (loadError) {
    return (
      <Card title="Live guidance">
        <p>{loadError}</p>
      </Card>
    );
  }

  if (!session?.plannedRoute) {
    return (
      <Card title="Live guidance">
        <p>Select a route first.</p>
      </Card>
    );
  }

  return (
    <div className="stack-lg assist-guidance-shell assist-live-page">
      <EncouragementBanner text="Stay smooth, keep three points of contact when possible, and let the cue lead the next move." />

      <Card
        title="Live guidance camera"
        className="assist-live-camera-card"
        bodyClassName="stack-md"
      >
        <CameraPreview
          stream={stream}
          label="Live climbing camera for pose-guided next-hold alignment"
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
            <span className="badge">Tracker</span>
            <p className="subtle-text">{controlError || poseState.error || poseState.statusLabel}</p>
          </div>
          <div>
            <span className="badge">Target</span>
            <p className="subtle-text">
              {liveCurrentHold ? `${liveCurrentHold.label} (${liveCurrentHold.color})` : 'No active target yet'}
            </p>
          </div>
          <div>
            <span className="badge">Alignment</span>
            <p className="subtle-text">
              {typeof alignmentPct === 'number'
                ? `${alignmentPct}%`
                : 'Waiting for the active limb'}
            </p>
          </div>
          <div>
            <span className="badge">Wall lock</span>
            <p className="subtle-text">
              {alignmentState.error
                ? alignmentState.error
                : `${alignmentState.statusLabel}${alignmentState.detector ? ` via ${alignmentState.detector}` : ''}`}
            </p>
          </div>
          <div>
            <span className="badge">Safety</span>
            <p className="subtle-text">
              {liveSafetyDecision.headline}. {liveSafetyDecision.detail}
            </p>
          </div>
        </div>
      </Card>

      <div className="assist-live-stage">
        <PositionHintCard
          cue={cue}
          targetLabel={liveCurrentHold?.label}
          progressLabel={guidance.currentCue?.progressLabel}
          isSpeaking={isSpeaking}
          poseStatus={liveSafetyDecision.status === 'ready' ? trackerHint : liveSafetyDecision.detail}
          alignmentPct={alignmentPct}
        />
      </div>

      <VoiceCuePanel
        cue={liveSafetyDecision.status === 'ready' ? `${cue} ${trackerHint}`.trim() : liveSafetyDecision.detail}
        progressLabel={guidance.currentCue?.progressLabel}
        isSpeaking={isSpeaking}
        onSpeak={() => speak(liveSafetyDecision.status === 'ready' ? manualCue : `Safety pause. ${liveSafetyDecision.detail}`)}
        onRepeat={() => (liveSafetyDecision.status === 'ready' ? repeat() : speak(`Safety pause. ${liveSafetyDecision.detail}`))}
        onAdvance={() => void handleAdvance('manual')}
        onNext={() => void handleAdvance('manual')}
        onRecalibrate={() => void handleRecalibrate()}
        onFinish={() => void handleFinish()}
      />
    </div>
  );
}
