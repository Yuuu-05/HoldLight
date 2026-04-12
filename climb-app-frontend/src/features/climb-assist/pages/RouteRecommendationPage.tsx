import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RouteCanvas from '../components/RouteCanvas';
import MascotStatusLoader from '../../../shared/components/illustration/MascotStatusLoader';
import Button from '../../../shared/components/ui/Button';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import {
  getClimbSessionApi,
  getLatestClimbScanApi,
  saveGuidanceLogsApi,
  updateClimbSessionApi,
} from '../../../shared/api/climbing.api';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { triggerHaptic } from '../../../shared/lib/haptics';
import { getActiveStoredScan, getActiveStoredSession } from '../store/climbAssist.store';
import { buildEditableRoutePlan } from '../services/routePlanner.service';
import type { ClimbScan, ClimbSession, Hold } from '../../../shared/types/climb';
import {
  describeRoutePlan,
  formatHoldColor,
  formatRouteFinishType,
  formatRouteStartType,
  formatReviewState,
  localizeAssistText,
} from '../utils/localizedAssistText';

export default function RouteRecommendationPage() {
  const [scan, setScan] = useState<ClimbScan | null>(null);
  const [session, setSession] = useState<ClimbSession | null>(null);
  const [loading, setLoading] = useState(true);
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

    setLoading(true);
    Promise.all([
      getLatestClimbScanApi().catch(() => getActiveStoredScan()),
      getClimbSessionApi().catch(() => getActiveStoredSession()),
    ]).then(([latestScan, activeSession]) => {
      if (!active) return;
      setScan(latestScan ?? getActiveStoredScan());
      setSession(activeSession ?? getActiveStoredSession());
      setLoadError(null);
    }).catch((error) => {
      if (!active) return;
      setScan(getActiveStoredScan());
      setSession(getActiveStoredSession());
      setLoadError(error instanceof Error ? error.message : 'Unable to load the recommended route.');
    }).finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
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

  const displayRoute = (editMode || hasCustomEdits) && editedRoute ? editedRoute : session?.plannedRoute ?? null;
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

    if (hold.color !== session.selectedColor) {
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

  if (loading) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Preparing live guidance')}
          message={t('The monkey is checking the route before live guidance starts.')}
        />
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Route recommendation')}
          message={localizeAssistText(loadError, language)}
        />
      </section>
    );
  }

  if (!scan || !session?.plannedRoute || !displayRoute) {
    return (
      <section className="assist-route-loading">
        <MascotStatusLoader
          title={t('Route recommendation')}
          message={t('Scan the wall and select a route first.')}
        />
        <Button onClick={() => navigate(routes.selectDifficulty)}>{t('Back to route choice')}</Button>
      </section>
    );
  }

  const selectedColorLabel = formatHoldColor(session.selectedColor, language, true);

  return (
    <div className="assist-route-page assist-route-builder-page">
      <div className="assist-route-builder-card assist-stable-card">
        <div className="assist-route-builder-canvas">
          <RouteCanvas
            wallMap={scan.wallMap}
            backgroundImageUrl={scan.coverImageUrl}
            plainImagePreview
            fitContainer
            highlightHoldIds={displayRoute.holdIds}
            currentHoldId={displayRoute.holds[0]?.id}
            selectedHoldId={selectedEditableHoldId ?? undefined}
            selectedHoldColor={session.selectedColor}
            onHoldSelect={editMode ? handleEditableHoldToggle : undefined}
            routeOverlays={routeOverlays}
            helperText={editMode ? t('Tap same-colour holds to add or remove them from the selected route.') : undefined}
          />
        </div>

        <aside className="assist-route-builder-panel">
          <div className="stack-sm">
            <strong>{t('Companion final route check')}</strong>
            <p className="subtle-text">
              {editMode
                ? t('Tap same-colour holds on the photo. The connected route updates immediately.')
                : t('Check the highlighted route with the climber. Use route correction if any hold is missing, then confirm to start guidance.')}
            </p>
          </div>

          <div className="assist-route-summary assist-route-builder-summary">
            <strong>{describeRoutePlan(displayRoute, language, session.selectedColor)}</strong>
            <div className="assist-route-insight-grid">
              <span className="assist-route-insight-pill">{selectedColorLabel}</span>
              <span className="assist-route-insight-pill">{t(session.difficulty)}</span>
              <span className="assist-route-insight-pill">
                {displayRoute.holds.length} / {sameColorHoldCount} {t('same-colour holds in route')}
              </span>
            </div>
          </div>

          {displayRoute.semantics ? (
            <div className="assist-route-summary assist-route-builder-summary">
              <div className="assist-route-insight-grid">
                <span className="assist-route-insight-pill">{t('Start:')} {formatRouteStartType(displayRoute.semantics.startType, language)}</span>
                <span className="assist-route-insight-pill">{t('Finish:')} {formatRouteFinishType(displayRoute.semantics.finishType, language)}</span>
                <span
                  className={`assist-route-insight-pill ${displayRoute.semantics.reviewState === 'review-recommended' ? 'is-review' : 'is-approved'}`}
                >
                  {formatReviewState(displayRoute.semantics.reviewState, language)}
                </span>
              </div>
            </div>
          ) : null}

          {actionError ? <p className="subtle-text" role="alert">{localizeAssistText(actionError, language)}</p> : null}

          <div className="assist-route-builder-actions">
            <Button
              type="button"
              variant={editMode ? 'primary' : 'secondary'}
              onClick={() => setEditMode((value) => !value)}
            >
              {editMode ? t('Finish route correction') : t('Correct route')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleResetEdits}
              disabled={!hasCustomEdits && !editMode}
            >
              {t('Reset route')}
            </Button>
            <Button onClick={() => void handleStartGuidance()} disabled={!routeIsReady}>
              {t('Confirm and start guidance')}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
