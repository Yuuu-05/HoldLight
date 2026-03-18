import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/ui/Card';
import RouteCanvas from '../components/RouteCanvas';
import Button from '../../../shared/components/ui/Button';
import { getClimbSessionApi, getLatestClimbScanApi, saveGuidanceLogsApi, updateClimbSessionApi } from '../../../shared/api/climbing.api';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import type { ClimbScan, ClimbSession } from '../../../shared/types/climb';

export default function RouteRecommendationPage() {
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [session, setSession] = useState<ClimbSession | null>(null);
  const navigate = useNavigate();
  usePageTitle('Route recommendation');

  useEffect(() => {
    Promise.all([getLatestClimbScanApi(), getClimbSessionApi()]).then(([latestScan, activeSession]) => {
      setScan(latestScan);
      setSession(activeSession);
    });
  }, []);

  async function handleStartGuidance() {
    if (!session) return;

    const nextSession = await updateClimbSessionApi(session.id, {
      status: 'guiding',
      currentTargetHoldId: session.plannedRoute?.holds[0]?.id || '',
    });

    setSession(nextSession);
    await saveGuidanceLogsApi([
      {
        id: `log_${Date.now()}`,
        sessionId: nextSession.id,
        type: 'scan_saved',
        message: `Route ${nextSession.selectedColor.toUpperCase()} is ready for live guidance.`,
        timestamp: new Date().toISOString(),
        payload: { routeId: nextSession.routeId },
      },
    ]);
    navigate(routes.liveGuidance);
  }

  if (!scan || !session?.plannedRoute) {
    return <Card title="Route recommendation"><p>Scan the wall and select a route first.</p></Card>;
  }

  return (
    <div className="stack-lg">
      <Card title={`Recommended ${session.selectedColor.toUpperCase()} route`}>
        <p>{session.plannedRoute.summary}</p>
        {scan.wallMap.analysis ? <p className="subtle-text">Provider: {scan.wallMap.analysis.provider}. This route only appears because the scan cleared the confidence gate.</p> : null}
        <div className="stats-grid">
          <div><strong>{session.difficulty}</strong><span>Guidance level</span></div>
          <div><strong>{session.plannedRoute.holds.length}</strong><span>Route holds</span></div>
          <div><strong>{session.plannedRoute.estimatedMoves}</strong><span>Estimated moves</span></div>
        </div>
      </Card>

      <Card title="Wall map and route highlight">
        <RouteCanvas
          wallMap={scan.wallMap}
          backgroundImageUrl={scan.coverImageUrl}
          highlightHoldIds={session.plannedRoute.holdIds}
          currentHoldId={session.plannedRoute.holds[0]?.id}
          helperText="Original wall image with detected hold overlays. Highlighted boxes belong to the route you selected for guidance."
        />
      </Card>

      <Card title="Route review">
        <ol className="numbered-list">
          <li>Verify that the highlighted holds match the intended route.</li>
          <li>If the scan looks wrong, go back and rescan or upload a clearer image.</li>
          <li>If the route looks right, continue to live guidance.</li>
        </ol>
        <div className="inline-actions wrap">
          <Button onClick={() => void handleStartGuidance()}>Start live guidance</Button>
          <Button variant="secondary" onClick={() => navigate(routes.selectDifficulty)}>Adjust route settings</Button>
        </div>
      </Card>
    </div>
  );
}
