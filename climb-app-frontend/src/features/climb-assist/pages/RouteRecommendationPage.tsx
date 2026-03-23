import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RouteCanvas from '../components/RouteCanvas';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import AssistBottomSheet from '../components/AssistBottomSheet';
import { getClimbSessionApi, getLatestClimbScanApi, saveGuidanceLogsApi, updateClimbSessionApi } from '../../../shared/api/climbing.api';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { triggerHaptic } from '../../../shared/lib/haptics';
import type { ClimbScan, ClimbSession } from '../../../shared/types/climb';

export default function RouteRecommendationPage() {
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [session, setSession] = useState<ClimbSession | null>(null);
  const navigate = useNavigate();
  const hasBuzzedRef = useRef(false);
  usePageTitle('Route recommendation');

  useEffect(() => {
    Promise.all([getLatestClimbScanApi(), getClimbSessionApi()]).then(([latestScan, activeSession]) => {
      setScan(latestScan);
      setSession(activeSession);
    });
  }, []);

  useEffect(() => {
    if (hasBuzzedRef.current || !session?.plannedRoute) {
      return;
    }

    triggerHaptic(50);
    hasBuzzedRef.current = true;
  }, [session?.plannedRoute]);

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
    <div className="assist-route-page assist-route-review-page">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Recommended ${session.selectedColor.toUpperCase()} route is ready. Slide the details drawer up to review the route before starting live guidance.`}
      </div>
      <div className="assist-route-preview-card">
        <div className="assist-route-preview-copy">
          <p className="assist-route-preview-kicker">Recommendation ready</p>
          <h1>{session.selectedColor.toUpperCase()} route highlighted</h1>
          <p>Review the highlighted holds first, then slide up the drawer to launch live guidance.</p>
        </div>
        <RouteCanvas
          wallMap={scan.wallMap}
          backgroundImageUrl={scan.coverImageUrl}
          highlightHoldIds={session.plannedRoute.holdIds}
          currentHoldId={session.plannedRoute.holds[0]?.id}
          helperText="Original wall image with detected hold overlays. Highlighted boxes belong to the route you selected for guidance."
        />
      </div>

      <AssistBottomSheet
        title={`Recommended ${session.selectedColor.toUpperCase()} route`}
        className="assist-recommendation-card"
        bodyClassName="stack-md"
      >
        <p>{session.plannedRoute.summary}</p>
        {scan.wallMap.analysis ? <p className="subtle-text">Provider: {scan.wallMap.analysis.provider}. This route only appears because the scan cleared the confidence gate.</p> : null}
        <div className="stats-grid">
          <div><strong>{session.difficulty}</strong><span>Guidance level</span></div>
          <div><strong>{session.plannedRoute.holds.length}</strong><span>Route holds</span></div>
          <div><strong>{session.plannedRoute.estimatedMoves}</strong><span>Estimated moves</span></div>
        </div>
        <ol className="numbered-list">
          <li>Verify that the highlighted holds match the intended route.</li>
          <li>If the scan looks wrong, go back and rescan or upload a clearer image.</li>
          <li>If the route looks right, continue to live guidance.</li>
        </ol>
        <div className="inline-actions wrap">
          <Button onClick={() => void handleStartGuidance()}>Start live guidance</Button>
          <Button variant="secondary" onClick={() => navigate(routes.selectDifficulty)}>Adjust route settings</Button>
        </div>
      </AssistBottomSheet>
    </div>
  );
}
