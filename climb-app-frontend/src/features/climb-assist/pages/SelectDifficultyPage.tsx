import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import DifficultySelector from '../components/DifficultySelector';
import RouteCanvas from '../components/RouteCanvas';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { createClimbSessionApi, getLatestClimbScanApi } from '../../../shared/api/climbing.api';
import { triggerHaptic } from '../../../shared/lib/haptics';
import { buildRoutePlan, getAvailableRouteCandidates } from '../services/routePlanner.service';
import { buildScanSafetyDecision } from '../services/safetyState.service';
import type { ClimbScan } from '../../../shared/types/climb';

export default function SelectDifficultyPage() {
  const [difficulty, setDifficulty] = useState('Beginner');
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const navigate = useNavigate();
  const hasBuzzedRef = useRef(false);

  usePageTitle('Select route');

  useEffect(() => {
    getLatestClimbScanApi().then((nextScan) => {
      setScan(nextScan);
      setLoadError(null);
      if (nextScan) {
        const [firstCandidate] = getAvailableRouteCandidates(nextScan.wallMap);
        setSelectedCandidateId(firstCandidate?.id ?? null);
      }
    }).catch((error) => {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the saved wall scan.');
    });
  }, []);

  const availableCandidates = useMemo(
    () => (scan ? getAvailableRouteCandidates(scan.wallMap) : []),
    [scan],
  );

  const visibleCandidates = useMemo(
    () => availableCandidates.slice(0, 5),
    [availableCandidates],
  );

  const selectedCandidate = useMemo(
    () => visibleCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [selectedCandidateId, visibleCandidates],
  );

  const previewRoutes = useMemo(
    () => {
      if (!scan) return [];

      return visibleCandidates.map((candidate) => ({
        candidate,
        route: buildRoutePlan(scan.wallMap, candidate, difficulty),
      }));
    },
    [difficulty, scan, visibleCandidates],
  );

  const previewRoute = useMemo(() => {
    if (!selectedCandidate) return null;
    return previewRoutes.find((entry) => entry.candidate.id === selectedCandidate.id)?.route ?? null;
  }, [previewRoutes, selectedCandidate]);

  const selectedSemantics = previewRoute?.semantics ?? selectedCandidate?.semantics ?? null;

  const routeOverlays = useMemo(
    () => previewRoutes.map(({ candidate, route }) => ({
      id: candidate.id,
      holdIds: route.holdIds,
      color: candidate.color,
      emphasis: candidate.id === selectedCandidateId ? 'primary' as const : 'secondary' as const,
    })),
    [previewRoutes, selectedCandidateId],
  );

  const scanSafetyDecision = useMemo(() => buildScanSafetyDecision(scan), [scan]);
  const autonomousReady = scanSafetyDecision.canSelectRoute;

  useEffect(() => {
    if (hasBuzzedRef.current || !autonomousReady || availableCandidates.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      triggerHaptic(50);
      hasBuzzedRef.current = true;
    }, 150);

    return () => window.clearTimeout(timer);
  }, [autonomousReady, availableCandidates.length]);

  async function handleContinue() {
    if (!scan || !selectedCandidate || !previewRoute) return;
    try {
      setActionError(null);
      await createClimbSessionApi({
        scanId: scan.id,
        routeId: previewRoute.id,
        selectedColor: selectedCandidate.color,
        difficulty,
        startedAt: new Date().toISOString(),
        cueIndex: 0,
        completed: false,
        currentTargetHoldId: previewRoute.holds[0]?.id || '',
        status: 'draft',
        plannedRoute: previewRoute,
        summaryStats: {
          holdsReached: 0,
          totalHolds: previewRoute.holds.length,
          cueCount: 0,
          recalibrationCount: 0,
          source: scan.wallMap.source,
        },
      });

      navigate(routes.routeRecommendation);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to create the climb session.');
    }
  }

  if (loadError) {
    return (
      <Card title="Select route and guidance level">
        <p>{loadError}</p>
      </Card>
    );
  }

  if (!scan) {
    return (
      <Card title="Select route and guidance level">
        <p>No wall scan found yet. Start by scanning the wall first.</p>
        <Button onClick={() => navigate(routes.scanWall)}>Go to scan</Button>
      </Card>
    );
  }

  if (!autonomousReady) {
    return (
      <Card title="Select route and guidance level">
        <p>{scanSafetyDecision.detail}</p>
        <Button onClick={() => navigate(routes.scanWall)}>Retake wall scan</Button>
      </Card>
    );
  }

  return (
    <div className="assist-route-page">
      <div className="assist-route-preview-card assist-stable-card">
        <div className="assist-route-preview-copy">
          <p className="assist-route-preview-kicker">Route matched</p>
          <h1>Pick the same-colour route that feels right</h1>
          <p>
            The wall stays visible in a stable preview so you can compare the highlighted holds
            before moving on.
          </p>
        </div>

        <RouteCanvas
          wallMap={scan.wallMap}
          backgroundImageUrl={scan.coverImageUrl}
          plainImagePreview
          highlightHoldIds={previewRoute?.holdIds ?? []}
          currentHoldId={previewRoute?.holds[0]?.id}
          routeOverlays={routeOverlays}
          helperText="Stable overlay preview of the scanned wall. Colored lines show each candidate path in move order. The selected route stays solid and highlighted."
        />
      </div>

      <Card
        title="Route recommendation"
        className="assist-route-selection-card assist-stable-card"
        bodyClassName="stack-md"
      >
        <p>
          Choose a guidance intensity and then select one of the same-colour route candidates
          that passed the backend confidence gate.
        </p>

        <DifficultySelector value={difficulty} onChange={setDifficulty} />

        <div className="segmented-control assist-route-pill-grid">
          {visibleCandidates.map((candidate) => (
            <Button
              key={candidate.id}
              variant={selectedCandidateId === candidate.id ? 'primary' : 'secondary'}
              className={`assist-route-pill ${selectedCandidateId === candidate.id ? 'is-active' : ''}`.trim()}
              onClick={() => setSelectedCandidateId(candidate.id)}
            >
              {candidate.color.toUpperCase()} {candidate.startRegion}
            </Button>
          ))}
        </div>

        {selectedCandidate && previewRoute ? (
          <div className="assist-route-summary">
            <strong>{previewRoute.summary}</strong>
            {selectedSemantics ? (
              <div className="assist-route-insight-grid">
                <span className="assist-route-insight-pill">Start: {selectedSemantics.startLabel}</span>
                <span className="assist-route-insight-pill">Finish: {selectedSemantics.finishLabel}</span>
                <span className="assist-route-insight-pill">Reachability: {selectedSemantics.reachabilityScore}%</span>
                <span className="assist-route-insight-pill">Stability: {selectedSemantics.stabilityScore}%</span>
                <span
                  className={`assist-route-insight-pill ${selectedSemantics.reviewState === 'review-recommended' ? 'is-review' : 'is-approved'}`}
                >
                  {selectedSemantics.reviewState === 'review-recommended' ? 'Setter review recommended' : 'Semantic checks passed'}
                </span>
              </div>
            ) : null}
            <p className="subtle-text">
              Confidence {Math.round(selectedCandidate.confidence * 100)}%.
              {' '}Estimated moves {previewRoute.estimatedMoves}.
              {' '}The highlighted line shows the selected route order from start to finish.
            </p>
            {selectedSemantics ? (
              <p className="subtle-text">{selectedSemantics.reviewSummary}</p>
            ) : null}
            {selectedSemantics?.setterNotes.length ? (
              <ul className="assist-route-note-list">
                {selectedSemantics.setterNotes.slice(0, 3).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            {selectedSemantics?.reviewHints.length ? (
              <ul className="assist-route-note-list assist-route-note-list-alert">
                {selectedSemantics.reviewHints.slice(0, 2).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {actionError ? <p className="subtle-text">{actionError}</p> : null}

        <Button onClick={() => void handleContinue()} disabled={!selectedCandidate}>
          Review route recommendation
        </Button>
      </Card>
    </div>
  );
}
