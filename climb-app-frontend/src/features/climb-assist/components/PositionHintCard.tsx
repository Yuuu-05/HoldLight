import Card from '../../../shared/components/ui/Card';

interface PositionHintCardProps {
  title?: string;
  cue: string;
  targetLabel?: string;
  poseStatus?: string;
  alignmentPct?: number;
}

export default function PositionHintCard({ title = 'Current movement hint', cue, targetLabel, poseStatus, alignmentPct }: PositionHintCardProps) {
  return (
    <Card title={title}>
      <p>{cue}</p>
      {targetLabel ? <p className="subtle-text">Target hold: {targetLabel}</p> : null}
      {poseStatus ? <p className="subtle-text">Tracker: {poseStatus}</p> : null}
      {typeof alignmentPct === 'number' ? <p className="subtle-text">Alignment confidence: {alignmentPct}%</p> : null}
    </Card>
  );
}
