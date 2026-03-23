import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function SpeechVolumeSwitcher() {
  const { speechVolume, setSpeechVolume } = useAccessibility();
  const { t } = useLanguage();

  return (
    <label className="field">
      <span className="field-label">{t('Voice volume')}</span>
      <input
        className="field-input slider-control"
        type="range"
        min="0.2"
        max="1"
        step="0.1"
        value={speechVolume}
        onChange={(event) => setSpeechVolume(Number(event.target.value))}
      />
      <span className="field-hint">{t('Current volume:')} {Math.round(speechVolume * 100)}%</span>
    </label>
  );
}
