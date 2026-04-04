import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RouteCanvas from '../components/RouteCanvas';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import {
  getClimbSessionApi,
  getLatestClimbScanApi,
  saveGuidanceLogsApi,
  updateClimbSessionApi,
} from '../../../shared/api/climbing.api';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { triggerHaptic } from '../../../shared/lib/haptics';
import { buildEditableRoutePlan } from '../services/routePlanner.service';
import type { ClimbScan, ClimbSession, Hold } from '../../../shared/types/climb';

export default function RouteRecommendationPage() {
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [session, setSession] = useState<ClimbSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedEditableHoldId, setSelectedEditableHoldId] = useState<string | null>(null);
  const [customHoldIds, setCustomHoldIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const hasBuzzedRef = useRef(false);

  usePageTitle('Route recommendation');

  useEffect(() => {
    Promise.all([getLatestClimbScanApi(), getClimbSessionApi()]).then(
      ([latestScan, activeSession]) => {
        setScan(latestScan);
        setSession(activeSession);
        setLoadError(null);
      },
    ).catch((error) => {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the recommended route.');
    });
  }, []);

  useEffect(() => {
    if (!session?.plannedRoute) return;
    setCustomHoldIds(session.plannedRoute.holdIds);
    setSelectedEditableHoldId(null);
    setEditMode(false);
  }, [session?.id, session?.plannedRoute?.id]);

  useEffect(() => {
    if (hasBuzzedRef.current || !session?.plannedRoute) {
      return;
    }

    const timer = window.setTimeout(() => {
      triggerHaptic(50);
      hasBuzzedRef.current = true;
    }, 150);

    return () => window.clearTimeout(timer);
  }, [session?.plannedRoute]);

  const sameColorHoldCount = useMemo(
    () => scan?.wallMap.holds.filter((hold) => hold.color === session?.selectedColor).length ?? 0,
    [scan, session?.selectedColor],
  );

  const editedRoute = useMemo(() => {
    if (!scan || !session?.plannedRoute) return null;
    return buildEditableRoutePlan(
      scan.wallMap,
      session.selectedColor,
      customHoldIds,
      session.difficulty,
    );
  }, [customHoldIds, scan, session?.difficulty, session?.plannedRoute, session?.selectedColor]);

  const hasCustomEdits = useMemo(() => {
    if (!session?.plannedRoute) return false;
    const originalIds = [...session.plannedRoute.holdIds].sort();
    const nextIds = [...customHoldIds].sort();
    return originalIds.length !== nextIds.length || originalIds.some((id, index) => id !== nextIds[index]);
  }, [customHoldIds, session?.plannedRoute]);

  const displayRoute = hasCustomEdits && editedRoute ? editedRoute : session?.plannedRoute ?? null;
  const routeIsReady = Boolean(displayRoute && displayRoute.holds.length >= 2);
  const routeOverlays = useMemo(
    () =>
      displayRoute
        ? [
            {
              id: displayRoute.id,
              holdIds: displayRoute.holdIds,
              color: session?.selectedColor,
              emphasis: 'primary' as const,
            },
          ]
        : [],
    [displayRoute, session?.selectedColor],
  );

  function handleEditableHoldToggle(hold: Hold) {
    if (!editMode || !session) return;
    if (hold.color !== session.selectedColor) return;

    setSelectedEditableHoldId(hold.id);
    setCustomHoldIds((currentIds) =>
      currentIds.includes(hold.id)
        ? currentIds.filter((id) => id !== hold.id)
        : [...currentIds, hold.id],
    );
    setActionError(null);
  }

  function handleResetEdits() {
    if (!session?.plannedRoute) return;
    setCustomHoldIds(session.plannedRoute.holdIds);
    setSelectedEditableHoldId(null);
    setEditMode(false);
    setActionError(null);
  }

  async function handleStartGuidance() {
    if (!session || !displayRoute || !routeIsReady) {
      setActionError('Select at least two same-colour holds before starting live guidance.');
      return;
    }
    try {
      setActionError(null);
      const nextSession = await updateClimbSessionApi(session.id, {
        routeId: displayRoute.id,
        status: 'guiding',
        currentTargetHoldId: displayRoute.holds[0]?.id || '',
        plannedRoute: displayRoute,
        summaryStats: {
          ...session.summaryStats,
          totalHolds: displayRoute.holds.length,
        },
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
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to start live guidance.');
    }
  }

  if (loadError) {
    return (
      <Card title="Route recommendation">
        <p>{loadError}</p>
      </Card>
    );
  }

    if (!scan || !session?.plannedRoute || !displayRoute) {
      return (
        <Card title="Route recommendation">
          <p>Scan the wall and select a route first.</p>
      </Card>
    );
  }

  return (
    <div className="assist-route-page assist-route-review-page">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Recommended ${session.selectedColor.toUpperCase()} route is ready. Review the route before starting live guidance.`}
      </div>

      <div className="assist-route-preview-card assist-stable-card">
        <div className="assist-route-preview-copy">
          <p className="assist-route-preview-kicker">Recommendation ready</p>
          <h1>{session.selectedColor.toUpperCase()} route highlighted</h1>
          <p>
            Review the highlighted same-colour holds first. If needed, switch into edit mode,
            tap holds to add or remove them, and the guided route will follow your edited line.
          </p>
        </div>

        <RouteCanvas
          wallMap={scan.wallMap}
          backgroundImageUrl={scan.coverImageUrl}
          plainImagePreview
          highlightHoldIds={displayRoute.holdIds}
          currentHoldId={displayRoute.holds[0]?.id}
          selectedHoldId={selectedEditableHoldId ?? undefined}
          onHoldSelect={editMode ? handleEditableHoldToggle : undefined}
          routeOverlays={routeOverlays}
          helperText={
            editMode
              ? 'Edit mode is active. Tap same-colour holds to add or remove them. The highlighted line updates immediately and live guidance will follow the edited route.'
              : 'Stable preview of the original wall image with detected hold overlays. Highlighted boxes and the route line belong to the selected same-colour route.'
          }
        />
      </div>

      <Card
        title={`Recommended ${session.selectedColor.toUpperCase()} route`}
        className="assist-recommendation-card assist-stable-card"
        bodyClassName="stack-md"
      >
        <p>{displayRoute.summary}</p>

        <div className="inline-actions wrap">
          <Button variant={editMode ? 'primary' : 'secondary'} onClick={() => setEditMode((value) => !value)}>
            {editMode ? 'Finish route editing' : 'Edit highlighted route'}
          </Button>
          <Button variant="secondary" onClick={handleResetEdits} disabled={!hasCustomEdits && !editMode}>
            Reset to system route
          </Button>
        </div>

        <p className="subtle-text">
          Same-colour holds selected: {customHoldIds.length} / {sameColorHoldCount}.
          {' '}
          {hasCustomEdits ? 'Your edited route preview is active.' : 'You are still viewing the system route.'}
        </p>

        {displayRoute.semantics ? (
          <div className="assist-route-summary">
            <div className="assist-route-insight-grid">
              <span className="assist-route-insight-pill">Start: {displayRoute.semantics.startLabel}</span>
              <span className="assist-route-insight-pill">Finish: {displayRoute.semantics.finishLabel}</span>
              <span className="assist-route-insight-pill">Reachability: {displayRoute.semantics.reachabilityScore}%</span>
              <span className="assist-route-insight-pill">Stability: {displayRoute.semantics.stabilityScore}%</span>
              <span
                className={`assist-route-insight-pill ${displayRoute.semantics.reviewState === 'review-recommended' ? 'is-review' : 'is-approved'}`}
              >
                {displayRoute.semantics.reviewState === 'review-recommended' ? 'Setter review recommended' : 'Semantic checks passed'}
              </span>
            </div>
            <p className="subtle-text">{displayRoute.semantics.reviewSummary}</p>
            <p className="subtle-text">
              Planner {displayRoute.semantics.plannerVersion}.
              {' '}
              {displayRoute.semantics.feedbackReady ? 'Setter feedback hooks are attached to this route plan.' : 'Feedback hooks unavailable.'}
            </p>
            {displayRoute.semantics.setterNotes.length ? (
              <ul className="assist-route-note-list">
                {displayRoute.semantics.setterNotes.slice(0, 4).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            {displayRoute.semantics.reviewHints.length ? (
              <ul className="assist-route-note-list assist-route-note-list-alert">
                {displayRoute.semantics.reviewHints.slice(0, 3).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {scan.wallMap.analysis ? (
          <p className="subtle-text">
            Provider: {scan.wallMap.analysis.provider}. This route only appears because the scan
            cleared the confidence gate.
          </p>
        ) : null}

        <div className="stats-grid">
          <div>
            <strong>{session.difficulty}</strong>
            <span>Guidance level</span>
          </div>
          <div>
            <strong>{displayRoute.holds.length}</strong>
            <span>Route holds</span>
          </div>
          <div>
            <strong>{displayRoute.estimatedMoves}</strong>
            <span>Estimated moves</span>
          </div>
        </div>

        <ol className="numbered-list">
          <li>Verify that the highlighted line matches the intended route.</li>
          <li>If needed, enable edit mode and tap same-colour holds to add or remove them.</li>
          <li>Start live guidance only after the edited route looks right.</li>
        </ol>

        {actionError ? <p className="subtle-text">{actionError}</p> : null}

        <div className="inline-actions wrap">
          <Button onClick={() => void handleStartGuidance()} disabled={!routeIsReady}>
            Start live guidance
          </Button>
          <Button variant="secondary" onClick={() => navigate(routes.selectDifficulty)}>
            Adjust route settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
