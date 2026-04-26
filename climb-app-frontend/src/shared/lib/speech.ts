export type SpeechLanguage = 'ZH' | 'EN';

export type SpeechPlaybackResult = {
  played: boolean;
  aborted: boolean;
  mode: 'browser' | null;
};

type SpeechOptions = {
  language?: SpeechLanguage;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
};

const VOICE_LOAD_TIMEOUT_MS = 1_800;
const SPEECH_START_TIMEOUT_MS = 700;

let activePlaybackId = 0;
let currentBrowserUtterance: SpeechSynthesisUtterance | null = null;
let voiceLoadPromise: Promise<SpeechSynthesisVoice[]> | null = null;

export function canUseSpeechSynthesis() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function canUseSpeechOutput() {
  return canUseSpeechSynthesis();
}

function resolveBrowserLanguage(language?: SpeechLanguage) {
  return language === 'ZH' ? 'zh-CN' : 'en-US';
}

function normalizeLanguage(language?: SpeechLanguage) {
  return language === 'ZH' ? 'zh-CN' : 'en-US';
}

function getAvailableBrowserVoices() {
  if (!canUseSpeechSynthesis()) {
    return [];
  }

  return window.speechSynthesis.getVoices();
}

function normalizeVoiceName(voiceName?: string) {
  return String(voiceName || '').trim().toLowerCase();
}

function scoreVoiceMatch(voice: SpeechSynthesisVoice, language: string) {
  const normalizedLanguage = language.toLowerCase();
  const primaryLanguage = normalizedLanguage.split('-')[0];
  const voiceLang = String(voice.lang || '').trim().toLowerCase();
  const voiceName = normalizeVoiceName(voice.name);

  if (voiceLang === normalizedLanguage) return 6;
  if (voiceLang.startsWith(`${primaryLanguage}-`)) return 5;
  if (voiceLang === primaryLanguage) return 4;

  if (
    primaryLanguage === 'zh'
    && (voiceName.includes('mandarin') || voiceName.includes('chinese') || voiceName.includes('zh'))
  ) {
    return 3;
  }

  if (primaryLanguage !== 'zh' && voice.default) return 1;
  return 0;
}

function findMatchingBrowserVoice(
  language: string,
  voiceName?: string,
  voices = getAvailableBrowserVoices(),
) {
  if (voices.length === 0) {
    return null;
  }

  const requestedVoice = normalizeVoiceName(voiceName);
  if (requestedVoice) {
    const exactMatch = voices.find((voice) => normalizeVoiceName(voice.name) === requestedVoice);
    if (exactMatch) {
      return exactMatch;
    }
  }

  let bestVoice: SpeechSynthesisVoice | null = null;
  let bestScore = 0;

  for (const voice of voices) {
    const score = scoreVoiceMatch(voice, language);
    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  return bestVoice;
}

function markBrowserSpeechEnded(utterance?: SpeechSynthesisUtterance | null) {
  if (utterance && currentBrowserUtterance !== utterance) {
    return;
  }
  currentBrowserUtterance = null;
}

async function loadBrowserVoices() {
  if (!canUseSpeechSynthesis()) {
    return [];
  }

  const existingVoices = getAvailableBrowserVoices();
  if (existingVoices.length > 0) {
    return existingVoices;
  }

  if (voiceLoadPromise) {
    return voiceLoadPromise;
  }

  voiceLoadPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const synth = window.speechSynthesis;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      synth.removeEventListener('voiceschanged', handleVoicesChanged);
      const voices = getAvailableBrowserVoices();
      voiceLoadPromise = null;
      resolve(voices);
    };

    const handleVoicesChanged = () => {
      if (getAvailableBrowserVoices().length > 0) {
        finish();
      }
    };

    const pollTimer = window.setInterval(handleVoicesChanged, 120);
    const timeoutTimer = window.setTimeout(finish, VOICE_LOAD_TIMEOUT_MS);

    synth.addEventListener('voiceschanged', handleVoicesChanged);
    handleVoicesChanged();
  });

  return voiceLoadPromise;
}

async function playBrowserSpeech(text: string, options: SpeechOptions | undefined, playbackId: number) {
  if (!canUseSpeechSynthesis()) {
    return false;
  }

  const targetLanguage = normalizeLanguage(options?.language);
  const voices = await loadBrowserVoices();

  if (playbackId !== activePlaybackId) {
    return false;
  }

  const matchedVoice = findMatchingBrowserVoice(targetLanguage, options?.voiceName, voices);

  if (targetLanguage.startsWith('zh') && voices.length > 0 && !matchedVoice) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 1;
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = options?.volume ?? 1;
  utterance.lang = targetLanguage;
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  currentBrowserUtterance = utterance;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const settle = (played: boolean) => {
      if (settled) return;
      settled = true;
      resolve(played);
    };

    utterance.onstart = () => {
      if (playbackId !== activePlaybackId) {
        window.speechSynthesis.cancel();
        markBrowserSpeechEnded(utterance);
        settle(false);
        return;
      }

      settle(true);
    };

    utterance.onend = () => {
      markBrowserSpeechEnded(utterance);
    };

    utterance.onerror = () => {
      markBrowserSpeechEnded(utterance);
      settle(false);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);

    window.setTimeout(() => {
      if (!settled) {
        settle(window.speechSynthesis.speaking || window.speechSynthesis.pending);
      }
    }, SPEECH_START_TIMEOUT_MS);
  });
}

export function isSpeechPlaying() {
  return Boolean(
    currentBrowserUtterance
    || (canUseSpeechSynthesis() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)),
  );
}

export async function speakText(text: string, options?: SpeechOptions): Promise<SpeechPlaybackResult> {
  stopSpeaking();
  const playbackId = activePlaybackId;
  const played = await playBrowserSpeech(text, options, playbackId);
  if (playbackId !== activePlaybackId) {
    return {
      played: false,
      aborted: true,
      mode: null,
    };
  }

  return {
    played,
    aborted: false,
    mode: played ? 'browser' : null,
  };
}

export function stopSpeaking() {
  activePlaybackId += 1;

  currentBrowserUtterance = null;

  if (canUseSpeechSynthesis()) {
    window.speechSynthesis.cancel();
  }
}

export function warmSpeechOutput(language?: SpeechLanguage) {
  if (!canUseSpeechSynthesis()) {
    return Promise.resolve();
  }

  window.speechSynthesis.getVoices();

  if (typeof language === 'string') {
    resolveBrowserLanguage(language);
  }

  return loadBrowserVoices().then(() => undefined);
}
