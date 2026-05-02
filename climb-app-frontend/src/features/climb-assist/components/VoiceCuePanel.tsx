import Button from '../../../shared/components/ui/Button';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface VoiceCuePanelProps {
  cue: string;
  progressLabel?: string;
  onSpeak: () => void;
  onRepeat: () => void;
  onNext?: () => void;
  onFinish?: () => void;
  onAdvance?: () => void;
  onRecalibrate?: () => void;
  isSpeaking?: boolean;
  finishDisabled?: boolean;
}

export default function VoiceCuePanel({
  cue,
  progressLabel,
  onSpeak,
  onRepeat,
  onNext,
  onFinish,
  onAdvance,
  onRecalibrate,
  isSpeaking = false,
  finishDisabled = false,
}: VoiceCuePanelProps) {
  const { simplifiedMode } = useAccessibility();
  const { t } = useLanguage();

  return (
    <section
      className={`stack voice-cue-panel assist-live-controls ${isSpeaking ? 'is-speaking' : ''}`.trim()}
      role="group"
      aria-label={t('Live guidance controls')}
    >
      <div className="assist-live-controls-meta">
        {progressLabel ? <span className="badge voice-cue-pill">{t('Current cue')} {progressLabel}</span> : null}
        <span className={`assist-live-voice-state ${isSpeaking ? 'is-speaking' : ''}`.trim()}>
          {isSpeaking ? t('Voice is guiding now') : t('Voice ready')}
        </span>
      </div>
      <p className={`subtle-text assist-live-controls-copy ${simplifiedMode ? 'is-prominent' : ''}`.trim()}>{cue}</p>
      <div className="inline-actions wrap voice-cue-actions assist-live-utility-actions">
        <Button variant="secondary" onClick={onSpeak}>
          {isSpeaking ? t('Speak again') : t('Speak cue')}
        </Button>
        <Button variant="ghost" onClick={onRepeat}>{t('Repeat')}</Button>
        {onAdvance ? <Button variant="ghost" onClick={onAdvance}>{t('Reached hold')}</Button> : null}
        {onRecalibrate ? <Button variant="secondary" onClick={onRecalibrate}>{t('Need recalibration')}</Button> : null}
      </div>
      <div className="assist-live-primary-actions">
        {onNext ? <Button variant="primary" className="assist-live-primary-button" onClick={onNext}>{t('Next')}</Button> : null}
        {onFinish ? (
          <Button variant="danger" className="assist-live-primary-button" onClick={onFinish} disabled={finishDisabled}>
            {t('End')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
