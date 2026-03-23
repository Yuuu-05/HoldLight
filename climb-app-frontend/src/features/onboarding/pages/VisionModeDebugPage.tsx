import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

export default function VisionModeDebugPage() {
  const { user, updatePreferences } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { speak } = useSpeech();
  const {
    hydrated,
    speechEnabled,
    feedbackEnabled,
    highContrast,
    largeText,
    simplifiedMode,
    voiceCommandsEnabled,
    speechRate,
    speechVolume,
    fontScale,
    setHighContrast,
    setSpeechVolume,
    setFontScale,
    applyVisualImpairmentPreset,
    announce,
  } = useAccessibility();
  const [submitting, setSubmitting] = useState(false);

  const isZh = language === 'zh';
  const shouldShowVisionSetup = user?.role === 'visually_impaired' && !user.preferences?.onboarding?.accessibilitySetupCompleted;

  usePageTitle(isZh ? '视障模式调试' : 'Vision mode setup');

  const previewText = useMemo(
    () => (
      isZh
        ? '我们先把语音、对比度和字体调到舒服一点。'
        : 'We are tuning voice volume, contrast, and text size first.'
    ),
    [isZh],
  );

  useEffect(() => {
    if (!hydrated || !shouldShowVisionSetup) return;
    applyVisualImpairmentPreset();
    announce(previewText);
    speak(previewText);
  }, [announce, applyVisualImpairmentPreset, hydrated, previewText, shouldShowVisionSetup, speak]);

  if (!user) return null;

  if (!shouldShowVisionSetup) {
    return <Navigate to={routes.onboarding} replace />;
  }

  if (!hydrated) {
    return (
      <section className="page-card onboarding-loading-card stack-md">
        <span className="eyebrow">{isZh ? '正在开启视障模式' : 'Turning on vision mode'}</span>
        <h1>{isZh ? '请稍等一下' : 'One moment please'}</h1>
        <p>{isZh ? '我们先同步你的偏好。' : 'We are syncing your preferences now.'}</p>
      </section>
    );
  }

  async function handleContinue() {
    setSubmitting(true);
    try {
      await updatePreferences({
        accessibility: {
          speechEnabled,
          feedbackEnabled,
          highContrast,
          largeText,
          simplifiedMode,
          voiceCommandsEnabled,
          speechRate,
          speechVolume,
          fontScale,
        },
        onboarding: {
          accessibilitySetupCompleted: true,
        },
      });

      navigate(routes.onboarding, { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  function handleVoicePreview() {
    const message = isZh ? '语音听起来应该比较清楚。' : 'The voice should sound clear and calm.';
    announce(message);
    speak(message);
  }

  const contrastLabel = highContrast
    ? (isZh ? '当前已是高对比度' : 'High contrast is on')
    : (isZh ? '当前为标准对比度' : 'Standard contrast is on');

  return (
    <section className="stack-lg onboarding-shell">
      <div className="page-card vision-debug-card">
        <div className="vision-debug-header">
          <div className="stack-sm">
            <span className="eyebrow">{isZh ? '视障模式调试页' : 'Vision mode debug'}</span>
            <h1>{isZh ? '我们先把界面调到舒服的状态' : 'Let us make the screen comfortable first'}</h1>
            <p>
              {isZh
                ? '这里只调三个东西：语音大小、界面对比度、字体大小。'
                : 'Only three things live here: voice volume, contrast, and text size.'}
            </p>
          </div>

          <GuideMascot className="guide-mascot vision-debug-mascot" pose="celebrate" />
        </div>

        <div className="guide-speech vision-debug-intro" role="note" aria-live="polite">
          <strong>{isZh ? '小猴提示' : 'Monkey tip'}</strong>
          <p>
            {isZh
              ? '你不需要自己找开关，我们先把最重要的三个选项调好。'
              : 'You do not need to hunt for settings. We will tune the important three for you.'}
          </p>
        </div>

        <div className="vision-debug-grid">
          <section className="vision-debug-card stack-md" aria-labelledby="vision-voice-heading">
            <div className="stack-sm">
              <span className="vision-debug-kicker">{isZh ? '语音大小' : 'Voice volume'}</span>
              <h2 id="vision-voice-heading">{isZh ? '先确认语音听得清' : 'First, check the voice'}</h2>
            </div>

            <label className="field vision-debug-slider">
              <span className="field-label">{isZh ? '语音音量' : 'Voice volume'}</span>
              <input
                className="field-input vision-debug-range"
                type="range"
                min="0.2"
                max="1"
                step="0.1"
                value={speechVolume}
                onChange={(event) => setSpeechVolume(Number(event.target.value))}
              />
              <span className="field-hint">
                {isZh ? `当前音量 ${Math.round(speechVolume * 100)}%` : `Current volume ${Math.round(speechVolume * 100)}%`}
              </span>
            </label>

            <Button variant="secondary" onClick={handleVoicePreview}>
              {isZh ? '播放语音样例' : 'Play voice sample'}
            </Button>
          </section>

          <section className="vision-debug-card stack-md" aria-labelledby="vision-contrast-heading">
            <div className="stack-sm">
              <span className="vision-debug-kicker">{isZh ? '界面对比度' : 'Interface contrast'}</span>
              <h2 id="vision-contrast-heading">{isZh ? '再看清楚一点' : 'Make the screen clearer'}</h2>
            </div>

            <div className="inline-actions wrap vision-debug-toggle-row">
              <Button
                variant={!highContrast ? 'primary' : 'secondary'}
                aria-pressed={!highContrast}
                onClick={() => setHighContrast(false)}
              >
                {isZh ? '标准对比度' : 'Standard'}
              </Button>
              <Button
                variant={highContrast ? 'primary' : 'secondary'}
                aria-pressed={highContrast}
                onClick={() => setHighContrast(true)}
              >
                {isZh ? '高对比度' : 'High contrast'}
              </Button>
            </div>

            <p className="vision-debug-status" aria-live="polite">
              {contrastLabel}
            </p>
          </section>

          <section className="vision-debug-card stack-md" aria-labelledby="vision-text-heading">
            <div className="stack-sm">
              <span className="vision-debug-kicker">{isZh ? '字体大小' : 'Text size'}</span>
              <h2 id="vision-text-heading">{isZh ? '把字调到容易读' : 'Set text to an easy size'}</h2>
            </div>

            <label className="field vision-debug-slider">
              <span className="field-label">{isZh ? '字体大小' : 'Text size'}</span>
              <input
                className="field-input vision-debug-range"
                type="range"
                min="1"
                max="1.4"
                step="0.1"
                value={fontScale}
                onChange={(event) => setFontScale(Number(event.target.value))}
              />
              <span className="field-hint">
                {isZh ? `当前字号 ${fontScale.toFixed(1)}x` : `Current size ${fontScale.toFixed(1)}x`}
              </span>
            </label>

            <div className="vision-debug-preview" style={{ fontSize: `${fontScale}rem` }}>
              <strong>{isZh ? '实时预览' : 'Live preview'}</strong>
              <p>{previewText}</p>
            </div>
          </section>
        </div>

        <div className="vision-debug-footer">
          <div className="vision-debug-summary">
            <span className="social-mini-pill">{isZh ? '视障模式已默认开启' : 'Vision mode is already on'}</span>
            <span className="social-mini-pill">{isZh ? '语音和反馈保持开启' : 'Voice and feedback stay on'}</span>
          </div>

          <div className="inline-actions wrap vision-debug-actions">
            <Button onClick={() => void handleContinue()} disabled={submitting}>
              {submitting ? (isZh ? '保存中…' : 'Saving...') : (isZh ? '这样就很好，继续' : 'This feels good, continue')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
