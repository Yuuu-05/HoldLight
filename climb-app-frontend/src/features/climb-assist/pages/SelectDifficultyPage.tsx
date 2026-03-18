import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import DifficultySelector from '../components/DifficultySelector';
import RouteCanvas from '../components/RouteCanvas';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { createClimbSessionApi, getLatestClimbScanApi } from '../../../shared/api/climbing.api';
import { buildRoutePlan, getAvailableRouteCandidates } from '../services/routePlanner.service';
import type { ClimbScan } from '../../../shared/types/climb';

export default function SelectDifficultyPage() {
  const [difficulty, setDifficulty] = useState('Beginner');
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const navigate = useNavigate();
  usePageTitle('Select route');

  useEffect(() => {
    getLatestClimbScanApi().then((nextScan) => {
      setScan(nextScan);
      if (nextScan) {
        const [firstCandidate] = getAvailableRouteCandidates(nextScan.wallMap);
        setSelectedCandidateId(firstCandidate?.id ?? null);
      }
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

  const scanAnalysis = scan?.wallMap.analysis;
  const autonomousReady = Boolean(scan && (scan.wallMap.source === 'demo' || scanAnalysis?.shouldAllowAutonomousGuidance));

  async function handleContinue() {
    if (!scan || !selectedCandidate || !previewRoute) return;

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
        <p>Automatic recognition has not cleared the accessibility gate yet, so autonomous route selection is blocked for this scan.</p>
        <div className="inline-actions wrap">
          <Button onClick={() => navigate(routes.scanWall)}>Retake wall scan</Button>
          <Button variant="secondary" onClick={() => navigate(routes.volunteerBoard)}>Open companion mode</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="stack-lg">
      <Card title="Select route and guidance level">
        <p>Choose a guidance intensity and then select one of the auto-detected route candidates that passed the backend confidence gate.</p>
        <DifficultySelector value={difficulty} onChange={setDifficulty} />
        <div className="segmented-control">
          {availableCandidates.map((candidate) => (
            <Button
              key={candidate.id}
              variant={selectedCandidateId === candidate.id ? 'primary' : 'secondary'}
              onClick={() => setSelectedCandidateId(candidate.id)}
            >
              {candidate.color.toUpperCase()} {candidate.startRegion}
            </Button>
          ))}
        </div>
        {selectedCandidate ? <p className="subtle-text">{selectedCandidate.summary}</p> : null}
        <Button onClick={() => void handleContinue()} disabled={!selectedCandidate}>Review route recommendation</Button>
      </Card>

      <Card title="Scanned wall preview">
        <RouteCanvas
          wallMap={scan.wallMap}
          backgroundImageUrl={scan.coverImageUrl}
          highlightHoldIds={previewRoute?.holdIds ?? []}
          currentHoldId={previewRoute?.holds[0]?.id}
          helperText="Overlay view of the scanned wall. Colored boxes show detected holds, and highlighted boxes show the currently selected route candidate."
        />
        {previewRoute ? <p className="subtle-text">{previewRoute.summary}</p> : null}
      </Card>
    </div>
  );
}
