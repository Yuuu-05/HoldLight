import Button from '../../../shared/components/ui/Button';

interface VoiceCuePanelProps {
  cue: string;
  progressLabel?: string;
  onSpeak: () => void;
  onRepeat: () => void;
  onNext?: () => void;
  onFinish?: () => void;
  onAdvance?: () => void;
  onRecalibrate?: () => void;
  isSpeaking?: boolean;
}

export default function VoiceCuePanel({
  cue,
  progressLabel,
  onSpeak,
  onRepeat,
  onNext,
  onFinish,
  onAdvance,
  onRecalibrate,
  isSpeaking = false,
}: VoiceCuePanelProps) {
  return (
    <section
      className={`stack voice-cue-panel assist-live-controls ${isSpeaking ? 'is-speaking' : ''}`.trim()}
      role="group"
      aria-label="Live guidance controls"
    >
      <div className="assist-live-controls-meta">
        {progressLabel ? <span className="badge voice-cue-pill">Current cue {progressLabel}</span> : null}
        <span className={`assist-live-voice-state ${isSpeaking ? 'is-speaking' : ''}`.trim()}>
          {isSpeaking ? 'Voice is guiding now' : 'Voice ready'}
        </span>
      </div>
      <p className="subtle-text assist-live-controls-copy">{cue}</p>
      <div className="inline-actions wrap voice-cue-actions assist-live-utility-actions">
        <Button variant="secondary" onClick={onSpeak}>
          {isSpeaking ? 'Speak again' : 'Speak cue'}
        </Button>
        <Button variant="ghost" onClick={onRepeat}>Repeat</Button>
        {onAdvance ? <Button variant="ghost" onClick={onAdvance}>Reached hold</Button> : null}
        {onRecalibrate ? <Button variant="secondary" onClick={onRecalibrate}>Need recalibration</Button> : null}
      </div>
      <div className="assist-live-primary-actions">
        {onNext ? <Button className="assist-live-primary-button" onClick={onNext}>Next</Button> : null}
        {onFinish ? <Button variant="danger" className="assist-live-primary-button" onClick={onFinish}>End</Button> : null}
      </div>
    </section>
  );
}
