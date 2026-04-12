import { useLanguage } from '../../../app/providers/LanguageProvider';
import { formatDifficulty, formatHoldColor } from '../utils/localizedAssistText';

interface SummaryStatsProps {
  difficulty: string;
  seconds: number;
  holdsReached?: number;
  totalHolds?: number;
  cueCount?: number;
  recalibrationCount?: number;
  selectedColor?: string;
}

export default function SummaryStats({
  difficulty,
  seconds,
  holdsReached,
  totalHolds,
  cueCount,
  recalibrationCount,
  selectedColor,
}: SummaryStatsProps) {
  const { language, t } = useLanguage();

  return (
    <div className="stats-grid">
      <div><strong>{formatDifficulty(difficulty, language)}</strong><span>{t('Difficulty')}</span></div>
      {selectedColor ? <div><strong>{formatHoldColor(selectedColor.toLowerCase(), language, true)}</strong><span>{t('Route color')}</span></div> : null}
      <div><strong>{seconds}s</strong><span>{t('Elapsed time')}</span></div>
      {typeof holdsReached === 'number' && typeof totalHolds === 'number' ? (
        <div><strong>{holdsReached}/{totalHolds}</strong><span>{t('Holds reached')}</span></div>
      ) : null}
      {typeof cueCount === 'number' ? <div><strong>{cueCount}</strong><span>{t('Voice cues')}</span></div> : null}
      {typeof recalibrationCount === 'number' ? <div><strong>{recalibrationCount}</strong><span>{t('Recalibrations')}</span></div> : null}
      <div><strong>{t('Complete')}</strong><span>{t('Session status')}</span></div>
    </div>
  );
}
