import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MascotStatusLoader from '../../../shared/components/illustration/MascotStatusLoader';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import DifficultySelector from '../components/DifficultySelector';
import RouteCanvas from '../components/RouteCanvas';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { createClimbSessionApi, getLatestClimbScanApi, saveGuidanceLogsApi } from '../../../shared/api/climbing.api';
import { triggerHaptic } from '../../../shared/lib/haptics';
import { getActiveStoredScan } from '../store/climbAssist.store';
import { buildEditableRoutePlan, buildRoutePlan, getAvailableRouteCandidates } from '../services/routePlanner.service';
import { buildScanSafetyDecision } from '../services/safetyState.service';
import type { ClimbScan, Hold } from '../../../shared/types/climb';
import {
  formatHoldColor,
  localizeAssistText,
} from '../utils/localizedAssistText';

export default function SelectDifficultyPage() {
  const [difficulty, setDifficulty] = useState('Beginner');
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loadingScan, setLoadingScan] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedEditableHoldId, setSelectedEditableHoldId] = useState<string | null>(null);
  const [customHoldIds, setCustomHoldIds] = useState<string[]>([]);
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const hasBuzzedRef = useRef(false);

  usePageTitle('Route check');

  useEffect(() => {
    let active = true;

    const applyLoadedScan = (nextScan: ClimbScan | null) => {
      if (!active) return;
      setScan(nextScan);
      if (nextScan) {
        const [firstCandidate] = getAvailableRouteCandidates(nextScan.wallMap);
        setSelectedCandidateId(firstCandidate?.id ?? null);
      } else {
        setSelectedCandidateId(null);
      }
    };

    setLoadingScan(true);
    getLatestClimbScanApi().then((nextScan) => {
      applyLoadedScan(nextScan ?? getActiveStoredScan());
      if (active) {
        setLoadError(null);
      }
    }).catch((error) => {
      const fallbackScan = getActiveStoredScan();
      if (fallbackScan) {
        applyLoadedScan(fallbackScan);
        if (active) {
          setLoadError(null);
        }
        return;
      }

      if (active) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load the saved wall scan.');
      }
    }).finally(() => {
      if (active) {
        setLoadingScan(false);
      }
    });

    return () => {
      active = false;
    };
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

  useEffect(() => {
    if (!previewRoute) {
      setCustomHoldIds([]);
      setSelectedEditableHoldId(null);
      setEditMode(false);
      return;
    }

    setCustomHoldIds(previewRoute.holdIds);
    setSelectedEditableHoldId(null);
    setEditMode(false);
  }, [previewRoute?.id, selectedCandidateId]);

  const editedRoute = useMemo(() => {
    if (!scan || !selectedCandidate) return null;
    return buildEditableRoutePlan(
      scan.wallMap,
      selectedCandidate.color,
      customHoldIds,
      difficulty,
    );
  }, [customHoldIds, difficulty, scan, selectedCandidate]);

  const hasCustomEdits = useMemo(() => {
    if (!previewRoute) return false;
    const originalIds = [...previewRoute.holdIds].sort();
    const nextIds = [...customHoldIds].sort();
    return originalIds.length !== nextIds.length || originalIds.some((id, index) => id !== nextIds[index]);
  }, [customHoldIds, previewRoute]);

  const displayRoute = (editMode || hasCustomEdits) && editedRoute ? editedRoute : previewRoute;
  const routeIsReady = Boolean(displayRoute && displayRoute.holds.length >= 2);

  const routeOverlays = useMemo(
    () =>
      previewRoutes.map(({ candidate, route }) => {
        const isSelected = candidate.id === selectedCandidateId;
        return {
          id: candidate.id,
          holdIds: isSelected && displayRoute ? displayRoute.holdIds : route.holdIds,
          color: candidate.color,
          emphasis: isSelected ? 'primary' as const : 'secondary' as const,
        };
      }),
    [displayRoute, previewRoutes, selectedCandidateId],
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

  useEffect(() => {
    if (loadingScan || loadError || scan) return;
    navigate(routes.scanWall, { replace: true });
  }, [loadError, loadingScan, navigate, scan]);

  function handleRouteSelect(candidateId: string) {
    setSelectedCandidateId(candidateId);
    setActionError(null);
  }

  function handleEditableHoldToggle(hold: Hold) {
    if (!editMode || !selectedCandidate) return;

    if (hold.color !== selectedCandidate.color) {
      setActionError('Only tap holds with the selected route color. Correct hold colors from the scan page if this hold belongs here.');
      return;
    }

    setSelectedEditableHoldId(hold.id);
    setCustomHoldIds((currentIds) =>
      currentIds.includes(hold.id)
        ? currentIds.filter((id) => id !== hold.id)
        : [...currentIds, hold.id],
    );
    setActionError(null);
  }

  function handleResetRouteEdits() {
    if (!previewRoute) return;
    setCustomHoldIds(previewRoute.holdIds);
    setSelectedEditableHoldId(null);
    setEditMode(false);
    setActionError(null);
  }

  async function handleContinue() {
    if (!scan || !selectedCandidate || !displayRoute || !routeIsReady) {
      setActionError('Select at least two same-colour holds before starting live guidance.');
      return;
    }

    try {
      setActionError(null);
      const nextSession = await createClimbSessionApi({
        scanId: scan.id,
        routeId: displayRoute.id,
        selectedColor: selectedCandidate.color,
        difficulty,
        startedAt: new Date().toISOString(),
        cueIndex: 0,
        completed: false,
        currentTargetHoldId: displayRoute.holds[0]?.id || '',
        status: 'guiding',
        plannedRoute: displayRoute,
        summaryStats: {
          holdsReached: 0,
          totalHolds: displayRoute.holds.length,
          cueCount: 0,
          recalibrationCount: 0,
          source: scan.wallMap.source,
        },
      });

      void saveGuidanceLogsApi([
        {
          id: `log_${Date.now()}`,
          sessionId: nextSession.id,
          type: 'scan_saved',
          message: `Route ${nextSession.selectedColor.toUpperCase()} is ready for live guidance.`,
          timestamp: new Date().toISOString(),
          payload: { routeId: nextSession.routeId },
        },
      ]).catch(() => undefined);

      navigate(routes.liveGuidance);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to create the climb session.');
    }
  }

  if (loadingScan) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Preparing route setup')}
          message={t('The monkey is carrying the corrected wall into route selection.')}
        />
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Preparing route setup')}
          message={localizeAssistText(loadError, language)}
        />
      </section>
    );
  }

  if (!scan) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Preparing route setup')}
          message={t('Returning to scan.')}
        />
      </section>
    );
  }

  if (!autonomousReady) {
    return (
      <Card title={t('Select route and guidance level')}>
        <p>{localizeAssistText(scanSafetyDecision.detail, language)}</p>
        <Button onClick={() => navigate(routes.scanWall)}>{t('Retake wall scan')}</Button>
      </Card>
    );
  }

  return (
    <div className="assist-route-page assist-route-builder-page">
      <div className="assist-route-builder-card assist-stable-card">
        <div className="assist-route-builder-canvas">
          <div className="assist-review-phone-stage assist-route-builder-photo-stage">
            <RouteCanvas
              wallMap={scan.wallMap}
              backgroundImageUrl={scan.coverImageUrl}
              plainImagePreview
              fitContainer
              fixedAspectRatio={3 / 4}
              highlightHoldIds={displayRoute?.holdIds ?? []}
              currentHoldId={displayRoute?.holds[0]?.id}
              selectedHoldId={selectedEditableHoldId ?? undefined}
              selectedHoldColor={selectedCandidate?.color}
              onHoldSelect={editMode ? handleEditableHoldToggle : undefined}
              onRouteSelect={handleRouteSelect}
              routeOverlays={routeOverlays}
            />
          </div>
        </div>

        <aside className="assist-route-builder-panel">
          <div className="assist-route-builder-head">
            <div className="assist-route-builder-title-row">
              <strong>{t('Companion route check')}</strong>
            </div>
          </div>

          <DifficultySelector value={difficulty} onChange={setDifficulty} />

          <div className="segmented-control assist-route-pill-grid">
            {visibleCandidates.map((candidate) => (
              <Button
                key={candidate.id}
                variant={selectedCandidateId === candidate.id ? 'primary' : 'secondary'}
                className={`assist-route-pill ${selectedCandidateId === candidate.id ? 'is-active' : ''}`.trim()}
                onClick={() => handleRouteSelect(candidate.id)}
              >
                {formatHoldColor(candidate.color, language, true)}
              </Button>
            ))}
          </div>

          {actionError ? <p className="subtle-text" role="alert">{localizeAssistText(actionError, language)}</p> : null}

          <div className="assist-route-builder-actions">
            <Button
              type="button"
              variant={editMode ? 'primary' : 'secondary'}
              onClick={() => setEditMode((current) => !current)}
              disabled={!selectedCandidate}
            >
              {editMode ? t('Finish route correction') : t('Correct route')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleResetRouteEdits}
              disabled={!hasCustomEdits && !editMode}
            >
              {t('Reset route')}
            </Button>
            <Button onClick={() => void handleContinue()} disabled={!selectedCandidate || !routeIsReady}>
              {t('Confirm and start guidance')}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
