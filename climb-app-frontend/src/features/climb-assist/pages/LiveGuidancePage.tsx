import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { getClimbSessionApi, saveGuidanceLogsApi, updateClimbSessionApi } from '../../../shared/api/climbing.api';
import VoiceCuePanel from '../components/VoiceCuePanel';
import EncouragementBanner from '../components/EncouragementBanner';
import PositionHintCard from '../components/PositionHintCard';
import Card from '../../../shared/components/ui/Card';
import { routes } from '../../../shared/constants/routes';
import { buildCueLabel } from '../../../shared/utils/routeVoiceText';
import { useGuidanceEngine } from '../hooks/useGuidanceEngine';
import type { ClimbSession } from '../../../shared/types/climb';

export default function LiveGuidancePage() {
  const { speak, repeat } = useSpeech();
  const [session, setSession] = useState<ClimbSession | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const navigate = useNavigate();
  const guidance = useGuidanceEngine(session?.plannedRoute, session?.cueIndex ?? 0);

  useEffect(() => {
    getClimbSessionApi().then((activeSession) => {
      setSession(activeSession);
    });
  }, []);

  useEffect(() => {
    if (!guidance.currentCue) return;
    speak(buildCueLabel(guidance.cueIndex, guidance.cues.length, guidance.currentCue.message));
  }, [guidance.cueIndex, guidance.cues.length, guidance.currentCue, speak]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setIsSpeaking(window.speechSynthesis.speaking);
    }, 120);

    return () => window.clearInterval(interval);
  }, []);

  const cue = useMemo(() => guidance.currentCue?.message ?? 'No cue available', [guidance.currentCue]);
  const spokenCue = useMemo(
    () => buildCueLabel(guidance.cueIndex, guidance.cues.length, cue),
    [cue, guidance.cueIndex, guidance.cues.length],
  );

  async function handleNext() {
    if (!session || !session.plannedRoute) return;

    const nextCueIndex = Math.min(guidance.cueIndex + 1, Math.max(0, guidance.cues.length - 1));
    const nextSession = await updateClimbSessionApi(session.id, {
      cueIndex: nextCueIndex,
      currentTargetHoldId: session.plannedRoute.holds[nextCueIndex]?.id || session.currentTargetHoldId,
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
        message: `Reached guidance step ${nextCueIndex + 1}.`,
        timestamp: new Date().toISOString(),
        payload: { cueIndex: nextCueIndex, holdId: nextSession.currentTargetHoldId },
      },
    ]);
  }

  async function handleFinish() {
    if (!session) return;

    const elapsedSeconds = Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000));
    const completedAt = new Date().toISOString();
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
  }

  if (!session?.plannedRoute) return <Card title="Live guidance"><p>Select a route first.</p></Card>;

  return (
    <div className="stack-lg assist-guidance-shell assist-live-page">
      <EncouragementBanner text="Great job. Keep your movement smooth and steady." />
      <div className="assist-live-stage">
        <PositionHintCard
          cue={cue}
          targetLabel={guidance.currentHold?.label}
          progressLabel={guidance.currentCue?.progressLabel}
          isSpeaking={isSpeaking}
        />
      </div>
      <VoiceCuePanel
        cue={cue}
        progressLabel={guidance.currentCue?.progressLabel}
        isSpeaking={isSpeaking}
        onSpeak={() => speak(spokenCue)}
        onRepeat={repeat}
        onNext={() => void handleNext()}
        onFinish={() => void handleFinish()}
      />
    </div>
  );
}
