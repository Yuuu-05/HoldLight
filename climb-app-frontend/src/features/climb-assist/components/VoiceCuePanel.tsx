import Button from '../../../shared/components/ui/Button';

interface VoiceCuePanelProps {
  cue: string;
  progressLabel?: string;
  onSpeak: () => void;
  onRepeat: () => void;
  onNext?: () => void;
  onAdvance?: () => void;
  onRecalibrate?: () => void;
}

export default function VoiceCuePanel({
  cue,
  progressLabel,
  onSpeak,
  onRepeat,
  onNext,
  onAdvance,
  onRecalibrate,
}: VoiceCuePanelProps) {
  return (
    <div className="stack">
      {progressLabel ? <span className="badge">Current cue {progressLabel}</span> : null}
      <p className="cue-text">{cue}</p>
      <div className="inline-actions wrap">
        <Button onClick={onSpeak}>Speak cue</Button>
        <Button variant="secondary" onClick={onRepeat}>Repeat</Button>
        {onNext ? <Button variant="ghost" onClick={onNext}>Next cue</Button> : null}
        {onAdvance ? <Button variant="ghost" onClick={onAdvance}>Reached hold</Button> : null}
        {onRecalibrate ? <Button variant="secondary" onClick={onRecalibrate}>Need recalibration</Button> : null}
      </div>
    </div>
  );
}
