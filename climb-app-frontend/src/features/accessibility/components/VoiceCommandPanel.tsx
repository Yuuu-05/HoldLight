import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import VoiceCommandButton from '../../../shared/components/accessibility/VoiceCommandButton';
import { routes } from '../../../shared/constants/routes';
import { canUseSpeechRecognition, getSpeechRecognitionCtor } from '../../../shared/lib/speechRecognition';

const commandMap: Record<string, string> = {
  'start scan': routes.scanWall,
  'repeat hint': routes.accessibilityHub,
  'return home': routes.dashboard,
  'open volunteer': routes.volunteerBoard,
};

export default function VoiceCommandPanel() {
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const { language, t } = useLanguage();
  const { voiceCommandsEnabled, announce } = useAccessibility();
  const { speak } = useSpeech();
  const supported = canUseSpeechRecognition();

  function startListening() {
    if (!voiceCommandsEnabled) {
      const message = t('Voice commands are currently disabled. Turn them on in accessibility settings first.');
      announce(message);
      speak(message);
      return;
    }

    if (!supported) {
      const message = t('Speech recognition is not supported on this device.');
      announce(message);
      speak(message);
      return;
    }

    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase();
      setTranscript(text);

      const target = Object.entries(commandMap).find(([command]) => text.includes(command))?.[1];
      if (target) {
        const message = language === 'zh'
          ? `${t('Voice command heard:')} ${text}。${t('Opening the requested page.')}`
          : `${t('Voice command heard:')} ${text}. ${t('Opening the requested page.')}`;
        announce(message);
        speak(message);
        navigate(target);
        return;
      }

      const message = language === 'zh'
        ? `${t('Voice command heard:')} ${text}。${t('No matching command was found.')}`
        : `${t('Voice command heard:')} ${text}. ${t('No matching command was found.')}`;
      announce(message);
      speak(message);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      announce(t('Voice command listening stopped because of a recognition error.'));
    };

    setListening(true);
    recognition.start();
  }

  return (
    <div className="stack">
      <VoiceCommandButton
        onClick={startListening}
        active={listening}
        disabled={!supported || !voiceCommandsEnabled}
      />
      <p className="subtle-text">
        {t('Try commands like "start scan", "repeat hint", "return home", or "open volunteer".')}
      </p>
      {!supported ? (
        <p className="subtle-text">{t('Speech recognition is not supported in this browser.')}</p>
      ) : null}
      {!voiceCommandsEnabled ? (
        <p className="subtle-text">{t('Enable voice commands first to start listening.')}</p>
      ) : null}
      {transcript ? (
        <p>
          {t('Heard')}: <strong>{transcript}</strong>
        </p>
      ) : null}
    </div>
  );
}
