import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { canUseSpeechSynthesis, speakText, stopSpeaking } from '../../shared/lib/speech';
import { useAccessibility } from './AccessibilityProvider';

interface SpeechState {
  supported: boolean;
  lastSpoken: string;
  speak: (text: string) => void;
  repeat: () => void;
  stop: () => void;
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

  const value = useMemo<SpeechState>(
    () => ({
      supported: canUseSpeechSynthesis(),
      lastSpoken: lastAnnouncement,
      speak: (text: string) => {
        if (!speechEnabled || !text) return;

        setLastAnnouncement(text);
        if (!speakText(text, { rate: speechRate, volume: speechVolume })) {
          announce('Speech synthesis is not supported on this device.');
        }
      },
      repeat: () => {
        if (!speechEnabled || !lastAnnouncement) return;
        speakText(lastAnnouncement, { rate: speechRate, volume: speechVolume });
      },
      stop: stopSpeaking,
    }),
    [announce, lastAnnouncement, setLastAnnouncement, speechEnabled, speechRate, speechVolume],
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech() {
  const context = useContext(SpeechContext);
  if (!context) throw new Error('useSpeech must be used within SpeechProvider');
  return context;
}
