import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import FontSizeSwitcher from '../components/FontSizeSwitcher';
import VoiceCommandPanel from '../components/VoiceCommandPanel';

export default function AccessibilityHubPage() {
  usePageTitle('Accessibility hub');
  const { language, t } = useLanguage();
  const {
    highContrast,
    largeText,
    feedbackEnabled,
    simplifiedMode,
    voiceCommandsEnabled,
    setHighContrast,
    setLargeText,
    setFeedbackEnabled,
    setSimplifiedMode,
    setVoiceCommandsEnabled,
    announce,
  } = useAccessibility();
  const { speak, repeat } = useSpeech();

  useEffect(() => {
    const intro = t('Manage the main accessibility options for reading, focus guidance, and voice interaction. This page is designed to show that accessibility is part of the system, not an extra decoration.');
    announce(intro);
    speak(intro);
  }, [announce, speak, t]);

  const handleToggle = (label: string, currentValue: boolean, setter: (value: boolean) => void) => {
    const nextValue = !currentValue;
    setter(nextValue);

    const message =
      language === 'zh'
        ? `${label}${nextValue ? '已开启。' : '已关闭。'}`
        : `${label} ${nextValue ? 'enabled.' : 'disabled.'}`;
    announce(message);
    speak(message);
  };

  return (
    <section className="stack-lg">
      <div className="page-card stack-lg">
        <div className="stack-sm">
          <p className="subtle-text">{t('Accessibility system')}</p>
          <h1>{t('Accessibility hub')}</h1>
          <p>{t('Manage the main accessibility options for reading, focus guidance, and voice interaction. This page is designed to show that accessibility is part of the system, not an extra decoration.')}</p>
        </div>

        <div className="stack-md">
          <div className="page-card stack-sm">
            <h2>{t('Reading and visibility')}</h2>
            <p>{t('Turn on stronger visual support and simpler reading settings.')}</p>

            <Button
              variant={highContrast ? 'primary' : 'secondary'}
              aria-pressed={highContrast}
              onClick={() => handleToggle(t('High contrast mode'), highContrast, setHighContrast)}
            >
              {highContrast ? t('Turn off high contrast') : t('Turn on high contrast')}
            </Button>

            <Button
              variant={largeText ? 'primary' : 'secondary'}
              aria-pressed={largeText}
              onClick={() => handleToggle(t('Large text'), largeText, setLargeText)}
            >
              {largeText ? t('Turn off large text') : t('Turn on large text')}
            </Button>

            <FontSizeSwitcher />
          </div>

          <div className="page-card stack-sm">
            <h2>{t('Feedback support')}</h2>
            <p>{t('Enable or disable spoken feedback when the user performs an action.')}</p>

            <Button
              variant={feedbackEnabled ? 'primary' : 'secondary'}
              aria-pressed={feedbackEnabled}
              onClick={() =>
                handleToggle(t('Operation feedback'), feedbackEnabled, setFeedbackEnabled)
              }
            >
              {feedbackEnabled
                ? t('Turn off operation feedback')
                : t('Turn on operation feedback')}
            </Button>

            <Button variant="ghost" onClick={repeat}>
              {t('Repeat last prompt')}
            </Button>
          </div>

          <div className="page-card stack-sm">
            <h2>{t('Simplified interface')}</h2>
            <p>{t('Reduce visual complexity and keep the current step clear.')}</p>

            <Button
              variant={simplifiedMode ? 'primary' : 'secondary'}
              aria-pressed={simplifiedMode}
              onClick={() => handleToggle(t('Simplified mode'), simplifiedMode, setSimplifiedMode)}
            >
              {simplifiedMode ? t('Turn off simplified mode') : t('Turn on simplified mode')}
            </Button>
          </div>

          <div className="page-card stack-sm">
            <h2>{t('Preview voice interaction')}</h2>
            <p>{t('Open the demo page to test fixed voice-style commands such as start scan, repeat hint, and go home.')}</p>

            <Button
              variant={voiceCommandsEnabled ? 'primary' : 'secondary'}
              aria-pressed={voiceCommandsEnabled}
              onClick={() =>
                handleToggle(t('Voice commands'), voiceCommandsEnabled, setVoiceCommandsEnabled)
              }
            >
              {voiceCommandsEnabled ? t('Turn off voice commands') : t('Turn on voice commands')}
            </Button>

            <VoiceCommandPanel />

            <Link className="text-link" to={routes.voiceMode}>
              {t('Open voice mode demo')}
            </Link>
          </div>

          <div className="page-card stack-sm">
            <h2>{t('Preview focus guidance')}</h2>
            <p>{t('Open a simple focus flow page to simulate VoiceOver-style navigation and focus announcements.')}</p>
            <Link className="text-link" to={routes.focusPreview}>
              {t('Open focus preview')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
