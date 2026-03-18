interface SummaryStatsProps {
  difficulty: string;
  seconds: number;
  holdsReached?: number;
  totalHolds?: number;
  cueCount?: number;
  recalibrationCount?: number;
  selectedColor?: string;
}

export default function SummaryStats({
  difficulty,
  seconds,
  holdsReached,
  totalHolds,
  cueCount,
  recalibrationCount,
  selectedColor,
}: SummaryStatsProps) {
  return (
    <div className="stats-grid">
      <div><strong>{difficulty}</strong><span>Difficulty</span></div>
      {selectedColor ? <div><strong>{selectedColor}</strong><span>Route color</span></div> : null}
      <div><strong>{seconds}s</strong><span>Elapsed time</span></div>
      {typeof holdsReached === 'number' && typeof totalHolds === 'number' ? (
        <div><strong>{holdsReached}/{totalHolds}</strong><span>Holds reached</span></div>
      ) : null}
      {typeof cueCount === 'number' ? <div><strong>{cueCount}</strong><span>Voice cues</span></div> : null}
      {typeof recalibrationCount === 'number' ? <div><strong>{recalibrationCount}</strong><span>Recalibrations</span></div> : null}
      <div><strong>Complete</strong><span>Session status</span></div>
    </div>
  );
}
