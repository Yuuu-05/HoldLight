import { useEffect, useRef, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import SummaryStats from '../components/SummaryStats';
import { getClimbSessionApi } from '../../../shared/api/climbing.api';
import { Link, useLocation } from 'react-router-dom';
import { routes } from '../../../shared/constants/routes';
import type { ClimbSession } from '../../../shared/types/climb';
import { triggerHaptic } from '../../../shared/lib/haptics';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { localizeAssistText, formatSessionDifficulty } from '../utils/localizedAssistText';
import { getActiveStoredSession } from '../store/climbAssist.store';

interface ClimbSummaryLocationState {
  completedSession?: ClimbSession | null;
}

function getCompletedSessionFromState(state: unknown) {
  if (!state || typeof state !== 'object' || !('completedSession' in state)) {
    return null;
  }

  return (state as ClimbSummaryLocationState).completedSession ?? null;
}

export default function ClimbSummaryPage() {
  const location = useLocation();
  const { language, t } = useLanguage();
  const initialSessionRef = useRef<ClimbSession | null | undefined>(undefined);

  if (initialSessionRef.current === undefined) {
    initialSessionRef.current = getCompletedSessionFromState(location.state) ?? getActiveStoredSession();
  }

  const [session, setSession] = useState<ClimbSession | null>(initialSessionRef.current);
  const [loading, setLoading] = useState(!initialSessionRef.current);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getClimbSessionApi().then((nextSession) => {
      if (!active) return;

      if (!nextSession) {
        if (!initialSessionRef.current) {
          setLoadError('Unable to load the climb summary.');
        }
        return;
      }

      if (!initialSessionRef.current || !initialSessionRef.current.completed || nextSession.id === initialSessionRef.current.id) {
        setSession(nextSession);
      }
      setLoadError(null);
    }).catch((error) => {
      if (!active || initialSessionRef.current) return;
      setLoadError(error instanceof Error ? error.message : 'Unable to load the climb summary.');
    }).finally(() => {
      if (active) {
        setLoading(false);
      }
    });
    triggerHaptic(18);

    return () => {
      active = false;
    };
  }, []);

  if (loading && !session && !loadError) {
    return (
      <div className="assist-summary-page">
        <Card title={t('Climb summary')} className="assist-summary-card" bodyClassName="stack-md">
          <p>{t('Loading')}</p>
        </Card>
      </div>
    );
  }

  if (loadError && !session) {
    return (
      <div className="assist-summary-page">
        <Card title={t('Climb summary')} className="assist-summary-card" bodyClassName="stack-md">
          <p>{localizeAssistText(loadError, language)}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="assist-summary-page">
      <Card title={t('Climb summary')} className="assist-summary-card" bodyClassName="stack-md">
        <SummaryStats
          difficulty={formatSessionDifficulty(session, language)}
          seconds={session?.elapsedSeconds ?? 0}
          holdsReached={session?.summaryStats.holdsReached}
          totalHolds={session?.summaryStats.totalHolds}
          cueCount={session?.summaryStats.cueCount}
          recalibrationCount={session?.summaryStats.recalibrationCount}
          selectedColor={session?.selectedColor}
        />
        <div className="inline-actions wrap">
          <Link to={routes.scanWall} className="btn btn-primary" onClick={() => triggerHaptic(10)}>
            {t('Start another climb')}
          </Link>
          <Link to={routes.dashboard} className="btn btn-secondary" onClick={() => triggerHaptic(10)}>
            {t('Back to dashboard')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
