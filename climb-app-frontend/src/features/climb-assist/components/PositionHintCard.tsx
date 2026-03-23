interface PositionHintCardProps {
  title?: string;
  cue: string;
  targetLabel?: string;
  poseStatus?: string;
  alignmentPct?: number;
  className?: string;
  isSpeaking?: boolean;
  progressLabel?: string;
}

export default function PositionHintCard({
  title = 'Current movement hint',
  cue,
  targetLabel,
  poseStatus,
  alignmentPct,
  className = '',
  isSpeaking = false,
  progressLabel,
}: PositionHintCardProps) {
  return (
    <section
      className={`assist-position-card cue-panel ${isSpeaking ? 'is-speaking' : ''} ${className}`.trim()}
      data-speaking={isSpeaking ? 'true' : 'false'}
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="assist-position-card-inner">
        <p className="assist-position-kicker">{title}</p>
        {progressLabel ? <span className="badge assist-position-progress">{progressLabel}</span> : null}
        <p className="cue-text assist-live-cue-text">{cue}</p>
      </div>
      {targetLabel || poseStatus || typeof alignmentPct === 'number' ? (
        <div className="assist-position-meta">
          {targetLabel ? <p className="subtle-text">Target hold: {targetLabel}</p> : null}
          {poseStatus ? <p className="subtle-text">Tracker: {poseStatus}</p> : null}
          {typeof alignmentPct === 'number' ? <p className="subtle-text">Alignment confidence: {alignmentPct}%</p> : null}
        </div>
      ) : null}
    </section>
  );
}
