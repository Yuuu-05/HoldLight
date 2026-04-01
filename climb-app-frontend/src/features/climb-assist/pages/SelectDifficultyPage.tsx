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

  const selectedCandidate = useMemo(
    () => availableCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [availableCandidates, selectedCandidateId],
  );

  const previewRoute = useMemo(() => {
    if (!scan || !selectedCandidate) return null;
    return buildRoutePlan(scan.wallMap, selectedCandidate, difficulty);
  }, [difficulty, scan, selectedCandidate]);

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
          helperText="Stable overlay preview of the scanned wall. Highlighted boxes show the currently selected same-colour route candidate."
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
          {availableCandidates.slice(0, 5).map((candidate) => (
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

        {selectedCandidate ? (
          <div className="assist-route-summary">
            <strong>{selectedCandidate.summary}</strong>
            <p className="subtle-text">
              Confidence {Math.round(selectedCandidate.confidence * 100)}%.
              {' '}Estimated moves {selectedCandidate.estimatedMoves}.
            </p>
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
