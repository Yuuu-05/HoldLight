import { env } from '../../app/config/env';

export type NaturalSpeechLanguage = 'ZH' | 'EN';

const SPEAK_TIMEOUT_MS = 15000;
const WARMUP_TIMEOUT_MS = 45000;

function buildUrl(path: string) {
  return `${env.apiBaseUrl.replace(/\/$/, '')}${path}`;
}

function createTimeoutSignal(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });

  return {
    signal: controller.signal,
    dispose: () => {
      window.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    },
  };
}

async function parseError(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);
    if (data?.message) {
      return data.message as string;
    }
  }

  const text = await response.text().catch(() => '');
  return text || 'Natural voice request failed.';
}

export async function fetchNaturalSpeechAudio(payload: {
  text: string;
  language: NaturalSpeechLanguage;
  speed?: number;
  speaker?: string;
  signal?: AbortSignal;
}) {
  const timeout = createTimeoutSignal(SPEAK_TIMEOUT_MS, payload.signal);

  try {
    const response = await fetch(buildUrl('/tts/speak'), {
      method: 'POST',
      headers: {
        Accept: 'audio/wav',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: payload.text,
        language: payload.language,
        speed: payload.speed,
        speaker: payload.speaker,
      }),
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    return {
      audioBlob: await response.blob(),
      provider: response.headers.get('x-tts-provider') || 'melo-tts',
      speaker: response.headers.get('x-tts-speaker') || '',
      cached: response.headers.get('x-tts-cached') === '1',
    };
  } finally {
    timeout.dispose();
  }
}

export async function warmNaturalSpeechVoice(language: NaturalSpeechLanguage) {
  const timeout = createTimeoutSignal(WARMUP_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(`/tts/health?warm=1&language=${encodeURIComponent(language)}`), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    return response.json();
  } finally {
    timeout.dispose();
  }
}
