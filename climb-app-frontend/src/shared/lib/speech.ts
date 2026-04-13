export type SpeechLanguage = 'ZH' | 'EN';

type SpeechPlaybackResult = {
  played: boolean;
  aborted: boolean;
  mode: 'browser' | null;
};

type SpeechOptions = {
  language?: SpeechLanguage;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export function canUseSpeechSynthesis() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function canUseSpeechOutput() {
  return canUseSpeechSynthesis();
}

function resolveBrowserLanguage(language?: SpeechLanguage) {
  return language === 'ZH' ? 'zh-CN' : 'en-US';
}

function playBrowserSpeech(text: string, options?: SpeechOptions) {
  if (!canUseSpeechSynthesis()) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 1;
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = options?.volume ?? 1;
  utterance.lang = resolveBrowserLanguage(options?.language);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export async function speakText(text: string, options?: SpeechOptions): Promise<SpeechPlaybackResult> {
  stopSpeaking();

  const played = playBrowserSpeech(text, options);
  return {
    played,
    aborted: false,
    mode: played ? 'browser' : null,
  };
}

export function stopSpeaking() {
  if (!canUseSpeechSynthesis()) return;
  window.speechSynthesis.cancel();
}

export function warmSpeechOutput(language?: SpeechLanguage) {
  if (!canUseSpeechSynthesis()) {
    return Promise.resolve();
  }

  window.speechSynthesis.getVoices();

  if (typeof language === 'string') {
    resolveBrowserLanguage(language);
  }

  return Promise.resolve();
}
