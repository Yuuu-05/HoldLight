import { useEffect, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import SummaryStats from '../components/SummaryStats';
import { getClimbSessionApi } from '../../../shared/api/climbing.api';
import { Link } from 'react-router-dom';
import { routes } from '../../../shared/constants/routes';
import type { ClimbSession } from '../../../shared/types/climb';
import { triggerHaptic } from '../../../shared/lib/haptics';

export default function ClimbSummaryPage() {
  const [session, setSession] = useState<ClimbSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getClimbSessionApi().then((nextSession) => {
      setSession(nextSession);
      setLoadError(null);
    }).catch((error) => {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the climb summary.');
    });
    triggerHaptic(18);
  }, []);

  if (loadError) {
    return (
      <Card title="Climb summary" className="assist-summary-card" bodyClassName="stack-md">
        <p>{loadError}</p>
      </Card>
    );
  }

  return (
    <Card title="Climb summary" className="assist-summary-card" bodyClassName="stack-md">
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
        <Link to={routes.scanWall} className="btn btn-primary" onClick={() => triggerHaptic(10)}>
          Start another climb
        </Link>
        <Link to={routes.dashboard} className="btn btn-secondary" onClick={() => triggerHaptic(10)}>
          Back to dashboard
        </Link>
      </div>
    </Card>
  );
}
