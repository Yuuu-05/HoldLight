import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { canUseSpeechOutput, speakText, stopSpeaking, warmNaturalSpeechOutput } from '../../shared/lib/speech';
import type { NaturalSpeechLanguage } from '../../shared/api/tts.api';
import { useAccessibility } from './AccessibilityProvider';
import { useLanguage } from './LanguageProvider';

interface SpeechOptions {
  language?: NaturalSpeechLanguage;
}

interface SpeechState {
  supported: boolean;
  lastSpoken: string;
  speak: (text: string, options?: SpeechOptions) => void;
  repeat: () => void;
  repeatWithOptions: (options?: SpeechOptions) => void;
  stop: () => void;
  warm: (language?: NaturalSpeechLanguage) => void;
}

const SpeechContext = createContext<SpeechState | null>(null);

export default function SpeechProvider({ children }: PropsWithChildren) {
  const {
    speechEnabled,
    speechRate,
    speechVolume,
    lastAnnouncement,
    setLastAnnouncement,
    announce,
  } = useAccessibility();
  const { language } = useLanguage();
  const speechLanguage = language === 'zh' ? 'ZH' : 'EN';
  const lastSpokenLanguageRef = useRef<NaturalSpeechLanguage>(speechLanguage);

  useEffect(() => {
    if (!speechEnabled) {
      stopSpeaking();
      return;
    }

    void warmNaturalSpeechOutput(speechLanguage);
  }, [speechEnabled, speechLanguage]);

  const value = useMemo<SpeechState>(
    () => ({
      supported: canUseSpeechOutput(),
      lastSpoken: lastAnnouncement,
      speak: (text: string, options?: SpeechOptions) => {
        if (!speechEnabled || !text) return;

        const targetLanguage = options?.language ?? speechLanguage;
        lastSpokenLanguageRef.current = targetLanguage;
        setLastAnnouncement(text);
        void speakText(text, { language: targetLanguage, rate: speechRate, volume: speechVolume }).then(
          (result) => {
            if (!result.played && !result.aborted) {
              announce('Speech synthesis is not supported on this device.');
            }
          },
        );
      },
      repeat: () => {
        if (!speechEnabled || !lastAnnouncement) return;
        void speakText(lastAnnouncement, {
          language: lastSpokenLanguageRef.current ?? speechLanguage,
          rate: speechRate,
          volume: speechVolume,
        });
      },
      repeatWithOptions: (options?: SpeechOptions) => {
        if (!speechEnabled || !lastAnnouncement) return;
        void speakText(lastAnnouncement, {
          language: options?.language ?? lastSpokenLanguageRef.current ?? speechLanguage,
          rate: speechRate,
          volume: speechVolume,
        });
      },
      stop: stopSpeaking,
      warm: (languageOverride?: NaturalSpeechLanguage) => {
        if (!speechEnabled) return;
        void warmNaturalSpeechOutput(languageOverride ?? speechLanguage);
      },
    }),
    [announce, lastAnnouncement, setLastAnnouncement, speechEnabled, speechLanguage, speechRate, speechVolume],
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech() {
  const context = useContext(SpeechContext);
  if (!context) throw new Error('useSpeech must be used within SpeechProvider');
  return context;
}
