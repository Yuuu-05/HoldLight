import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import {
  canUseSpeechOutput,
  speakText,
  stopSpeaking,
  warmSpeechOutput,
  type SpeechLanguage,
  type SpeechPlaybackResult,
} from '../../shared/lib/speech';
import { useAccessibility } from './AccessibilityProvider';
import { useLanguage } from './LanguageProvider';

interface SpeechOptions {
  language?: SpeechLanguage;
}

interface SpeechState {
  supported: boolean;
  lastSpoken: string;
  speak: (text: string, options?: SpeechOptions) => Promise<SpeechPlaybackResult>;
  repeat: () => Promise<SpeechPlaybackResult>;
  repeatWithOptions: (options?: SpeechOptions) => Promise<SpeechPlaybackResult>;
  stop: () => void;
  warm: (language?: SpeechLanguage) => void;
}

const SpeechContext = createContext<SpeechState | null>(null);
const SPEECH_UNAVAILABLE_RESULT: SpeechPlaybackResult = {
  played: false,
  aborted: false,
  mode: null,
};

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
  const lastSpokenLanguageRef = useRef<SpeechLanguage>(speechLanguage);

  useEffect(() => {
    if (!speechEnabled) {
      stopSpeaking();
      return;
    }

    void warmSpeechOutput(speechLanguage);
  }, [speechEnabled, speechLanguage]);

  const value = useMemo<SpeechState>(
    () => ({
      supported: canUseSpeechOutput(),
      lastSpoken: lastAnnouncement,
      speak: async (text: string, options?: SpeechOptions) => {
        if (!speechEnabled || !text) return SPEECH_UNAVAILABLE_RESULT;

        const targetLanguage = options?.language ?? speechLanguage;
        lastSpokenLanguageRef.current = targetLanguage;
        setLastAnnouncement(text);
        const result = await speakText(text, {
          language: targetLanguage,
          rate: speechRate,
          volume: speechVolume,
        });

        if (!result.played && !result.aborted) {
          announce('Speech synthesis is not supported on this device.');
        }

        return result;
      },
      repeat: () => {
        if (!speechEnabled || !lastAnnouncement) return Promise.resolve(SPEECH_UNAVAILABLE_RESULT);
        return speakText(lastAnnouncement, {
          language: lastSpokenLanguageRef.current ?? speechLanguage,
          rate: speechRate,
          volume: speechVolume,
        });
      },
      repeatWithOptions: (options?: SpeechOptions) => {
        if (!speechEnabled || !lastAnnouncement) return Promise.resolve(SPEECH_UNAVAILABLE_RESULT);
        return speakText(lastAnnouncement, {
          language: options?.language ?? lastSpokenLanguageRef.current ?? speechLanguage,
          rate: speechRate,
          volume: speechVolume,
        });
      },
      stop: stopSpeaking,
      warm: (languageOverride?: SpeechLanguage) => {
        if (!speechEnabled) return;
        void warmSpeechOutput(languageOverride ?? speechLanguage);
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
