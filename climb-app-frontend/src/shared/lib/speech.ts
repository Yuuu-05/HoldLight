import { fetchNaturalSpeechAudio, type NaturalSpeechLanguage, warmNaturalSpeechVoice } from '../api/tts.api';

type SpeechPlaybackResult = {
  played: boolean;
  aborted: boolean;
  mode: 'natural' | 'browser' | null;
};

type SpeechOptions = {
  language?: NaturalSpeechLanguage;
  rate?: number;
  pitch?: number;
  volume?: number;
};

const NATURAL_SPEECH_FAILURE_COOLDOWN_MS = 30000;
const AUDIO_CACHE_LIMIT = 12;

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeRequestController: AbortController | null = null;
let lastNaturalSpeechFailureAt = 0;
const audioBlobCache = new Map<string, Blob>();
const warmupState = new Map<NaturalSpeechLanguage, Promise<unknown>>();

export function canUseSpeechSynthesis() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function canUseAudioPlayback() {
  return typeof window !== 'undefined' && typeof window.Audio !== 'undefined';
}

export function canUseSpeechOutput() {
  return canUseSpeechSynthesis() || canUseAudioPlayback();
}

function cacheKeyForSpeech(text: string, options?: SpeechOptions) {
  return JSON.stringify({
    text,
    language: options?.language || 'EN',
    rate: options?.rate ?? 1,
  });
}

function rememberAudioBlob(key: string, blob: Blob) {
  audioBlobCache.set(key, blob);
  while (audioBlobCache.size > AUDIO_CACHE_LIMIT) {
    const oldestKey = audioBlobCache.keys().next().value;
    if (typeof oldestKey === 'string') {
      audioBlobCache.delete(oldestKey);
    }
  }
}

function readCachedAudioBlob(key: string) {
  const blob = audioBlobCache.get(key);
  if (!blob) {
    return null;
  }

  audioBlobCache.delete(key);
  audioBlobCache.set(key, blob);
  return blob;
}

function cleanupActiveAudio(targetAudio?: HTMLAudioElement | null) {
  if (targetAudio && activeAudio !== targetAudio) {
    return;
  }

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }

  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

function playBrowserSpeech(text: string, options?: SpeechOptions) {
  if (!canUseSpeechSynthesis()) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 1;
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = options?.volume ?? 1;
  utterance.lang = options?.language === 'ZH' ? 'zh-CN' : 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

async function playNaturalSpeech(text: string, options?: SpeechOptions): Promise<SpeechPlaybackResult> {
  if (!canUseAudioPlayback()) {
    return { played: false, aborted: false, mode: null };
  }

  const now = Date.now();
  if (now - lastNaturalSpeechFailureAt < NATURAL_SPEECH_FAILURE_COOLDOWN_MS) {
    return { played: false, aborted: false, mode: null };
  }

  const requestController = new AbortController();
  activeRequestController = requestController;

  const cacheKey = cacheKeyForSpeech(text, options);
  const cachedBlob = readCachedAudioBlob(cacheKey);

  try {
    const blob =
      cachedBlob
      || (
        await fetchNaturalSpeechAudio({
          text,
          language: options?.language || 'EN',
          speed: options?.rate ?? 1,
          signal: requestController.signal,
        })
      ).audioBlob;

    rememberAudioBlob(cacheKey, blob);

    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.volume = options?.volume ?? 1;
    audio.preload = 'auto';

    activeAudio = audio;
    activeAudioUrl = objectUrl;
    activeRequestController = null;

    audio.onended = () => cleanupActiveAudio(audio);
    audio.onerror = () => cleanupActiveAudio(audio);

    await audio.play();
    lastNaturalSpeechFailureAt = 0;

    return { played: true, aborted: false, mode: 'natural' };
  } catch (error) {
    activeRequestController = null;

    if (requestController.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      return { played: false, aborted: true, mode: null };
    }

    cleanupActiveAudio();
    lastNaturalSpeechFailureAt = Date.now();
    return { played: false, aborted: false, mode: null };
  }
}

export async function speakText(text: string, options?: SpeechOptions): Promise<SpeechPlaybackResult> {
  stopSpeaking();

  const naturalResult = await playNaturalSpeech(text, options);
  if (naturalResult.played || naturalResult.aborted) {
    return naturalResult;
  }

  const played = playBrowserSpeech(text, options);
  return {
    played,
    aborted: false,
    mode: played ? 'browser' : null,
  };
}

export function stopSpeaking() {
  if (activeRequestController) {
    activeRequestController.abort();
    activeRequestController = null;
  }

  cleanupActiveAudio();

  if (!canUseSpeechSynthesis()) return;
  window.speechSynthesis.cancel();
}

export function warmNaturalSpeechOutput(language: NaturalSpeechLanguage) {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const existing = warmupState.get(language);
  if (existing) {
    return existing;
  }

  const warmupPromise = warmNaturalSpeechVoice(language)
    .catch(() => undefined)
    .finally(() => {
      warmupState.delete(language);
    });

  warmupState.set(language, warmupPromise);
  return warmupPromise;
}
