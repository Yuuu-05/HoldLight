import { useEffect, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import SummaryStats from '../components/SummaryStats';
import { getClimbSessionApi } from '../../../shared/api/climbing.api';
import { Link } from 'react-router-dom';
import { routes } from '../../../shared/constants/routes';
import type { ClimbSession } from '../../../shared/types/climb';
import { triggerHaptic } from '../../../shared/lib/haptics';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { localizeAssistText, formatSessionDifficulty } from '../utils/localizedAssistText';

export default function ClimbSummaryPage() {
  const [session, setSession] = useState<ClimbSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { language, t } = useLanguage();

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
      <Card title={t('Climb summary')} className="assist-summary-card" bodyClassName="stack-md">
        <p>{localizeAssistText(loadError, language)}</p>
      </Card>
    );
  }

  return (
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
  );
}
