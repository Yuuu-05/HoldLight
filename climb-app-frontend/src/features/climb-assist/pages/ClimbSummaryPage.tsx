import { useEffect, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import SummaryStats from '../components/SummaryStats';
import Button from '../../../shared/components/ui/Button';
import { getClimbSessionApi } from '../../../shared/api/climbing.api';
import { Link } from 'react-router-dom';
import { routes } from '../../../shared/constants/routes';
import type { ClimbSession } from '../../../shared/types/climb';

export default function ClimbSummaryPage() {
  const [session, setSession] = useState<ClimbSession | null>(null);

  useEffect(() => {
    getClimbSessionApi().then(setSession);
  }, []);

  return (
    <Card title="Climb summary">
      <p>This closing page delivers the final feedback requested in module C: completion state, approximate time, and a short encouragement summary.</p>
      <SummaryStats
        difficulty={session?.difficulty ?? 'Beginner'}
        seconds={session?.elapsedSeconds ?? 0}
        holdsReached={session?.summaryStats.holdsReached}
        totalHolds={session?.summaryStats.totalHolds}
        cueCount={session?.summaryStats.cueCount}
        recalibrationCount={session?.summaryStats.recalibrationCount}
        selectedColor={session?.selectedColor?.toUpperCase()}
      />
      <p className="success-banner">Nice work. You completed the route guidance flow and now have a reusable session summary.</p>
      <div className="inline-actions wrap">
        <Link to={routes.scanWall}><Button>Start another climb</Button></Link>
        <Link to={routes.dashboard}><Button variant="secondary">Back to dashboard</Button></Link>
      </div>
    </Card>
  );
}
