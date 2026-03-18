import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function FontSizeSwitcher() {
  const { fontScale, setFontScale } = useAccessibility();
  const { language, t } = useLanguage();
  return (
    <label className="field">
      <span className="field-label">{t('Font size')}</span>
      <input
        className="field-input"
        type="range"
        min="1"
        max="1.4"
        step="0.1"
        value={fontScale}
        onChange={(event) => setFontScale(Number(event.target.value))}
      />
      <span className="field-hint">{t('Current scale:')} {language === 'zh' ? `${fontScale.toFixed(1)} 倍` : `${fontScale.toFixed(1)}x`}</span>
    </label>
  );
}
