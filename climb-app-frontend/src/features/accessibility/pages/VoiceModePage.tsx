import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import VoiceCommandPanel from '../components/VoiceCommandPanel';

const commandHints = [
  'Start scan',
  'Repeat hint',
  'Go home',
  'Read this page',
  'Stop reading',
];

export default function VoiceModePage() {
  usePageTitle('Voice mode demo');
  const { t } = useLanguage();
  const [lastMessage, setLastMessage] = useState(t('Voice mode is ready. Choose a command button to preview spoken feedback.'));
  const { speak, stop } = useSpeech();
  const { announce, voiceCommandsEnabled, setVoiceCommandsEnabled } = useAccessibility();

  useEffect(() => {
    const intro = t('This page demonstrates simple voice-style interaction with fixed commands. The goal is not complex AI, but clear and reliable interaction for beginners and visually impaired users.');
    announce(intro);
    speak(intro);
  }, [announce, speak, t]);

  const handleCommand = (message: string) => {
    setLastMessage(message);
    announce(message);
    speak(message);
  };

  const handleStopReading = () => {
    stop();
    const message = t('Reading stopped.');
    setLastMessage(message);
    announce(message);
  };

  return (
    <section className="stack-lg">
      <div className="page-card stack-lg">
        <div className="stack-sm">
          <p className="subtle-text">{t('Accessibility demo')}</p>
          <h1>{t('Voice mode demo')}</h1>
          <p>{t('This page demonstrates simple voice-style interaction with fixed commands. The goal is not complex AI, but clear and reliable interaction for beginners and visually impaired users.')}</p>
        </div>

        <div className="page-card stack-sm">
          <h2>{t('Available commands')}</h2>
          <ul className="clean-list">
            {commandHints.map((command) => (
              <li key={command}>{t(command)}</li>
            ))}
          </ul>
        </div>

        <div className="page-card stack-sm">
          <h2>{t('Voice commands')}</h2>
          <p>{t('Enable voice commands first to start listening.')}</p>
          <Button
            variant={voiceCommandsEnabled ? 'primary' : 'secondary'}
            aria-pressed={voiceCommandsEnabled}
            onClick={() => setVoiceCommandsEnabled(!voiceCommandsEnabled)}
          >
            {voiceCommandsEnabled ? t('Turn off voice commands') : t('Turn on voice commands')}
          </Button>
          <VoiceCommandPanel />
        </div>

        <div className="stack-md">
          <Button
            variant="secondary"
            onClick={() =>
              handleCommand('Starting scan. Please point the camera toward the climbing wall.')
            }
          >
            {t('Start scan')}
          </Button>

          <Button
            variant="secondary"
            onClick={() =>
              handleCommand('Repeating the last hint. Move your right hand slightly higher.')
            }
          >
            {t('Repeat hint')}
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleCommand('Returning to the home page.')}
          >
            {t('Go home')}
          </Button>

          <Button
            variant="secondary"
            onClick={() =>
              handleCommand(
                'You are on the voice mode demo page. This page shows simple fixed voice commands for accessibility support.',
              )
            }
          >
            {t('Read this page')}
          </Button>

          <Button variant="ghost" onClick={handleStopReading}>
            {t('Stop reading')}
          </Button>
        </div>

        <div className="page-card stack-sm" aria-live="polite">
          <h2>{t('Latest feedback')}</h2>
          <p>{lastMessage}</p>
        </div>

        <Link className="text-link" to={routes.accessibilityHub}>
          {t('Back to accessibility hub')}
        </Link>
      </div>
    </section>
  );
}
