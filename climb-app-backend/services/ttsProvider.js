const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const { resolvePythonCommand } = require('./pythonRuntime');

const PROVIDER_NAME = 'melo-tts';
const TTS_SERVICE_SCRIPT = path.join(__dirname, '..', 'tts_service', 'server.py');
const PYTHON_COMMAND = resolvePythonCommand('TTS_PYTHON_COMMAND', ['.venv-tts', '.venv']);
const CACHE_SIZE = Number.parseInt(process.env.TTS_CACHE_SIZE || '24', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.TTS_REQUEST_TIMEOUT_MS || '90000', 10);
const DISABLED_VALUES = new Set(['0', 'false', 'off', 'no']);
const DEFAULT_LANGUAGE = normalizeLanguage(process.env.MELO_TTS_DEFAULT_LANGUAGE || 'ZH');

function isEnabled() {
  return !DISABLED_VALUES.has(String(process.env.TTS_ENABLED ?? 'true').trim().toLowerCase());
}

function normalizeLanguage(value) {
  const normalized = String(value || DEFAULT_LANGUAGE).trim().toUpperCase();
  if (['ZH', 'EN', 'ES', 'FR', 'JP', 'KR'].includes(normalized)) {
    return normalized;
  }

  throw new Error(`Unsupported TTS language "${value}".`);
}

function normalizeSpeed(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(1.8, Math.max(0.6, parsed));
}

function normalizeText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new Error('Text is required for speech synthesis.');
  }

  if (text.length > 1200) {
    throw new Error('Text is too long for a single speech request. Please keep it under 1200 characters.');
  }

  return text;
}

function createCacheKey({ text, language, speaker, speed }) {
  return JSON.stringify({ text, language, speaker: speaker || null, speed });
}

class MeloTtsBridge {
  constructor() {
    this.child = null;
    this.stdoutReader = null;
    this.pending = new Map();
    this.cache = new Map();
    this.lastError = '';
    this.stderrHistory = [];
    this.startPromise = null;
  }

  async synthesize(payload) {
    const request = {
      text: normalizeText(payload.text),
      language: normalizeLanguage(payload.language || DEFAULT_LANGUAGE),
      speaker: typeof payload.speaker === 'string' && payload.speaker.trim() ? payload.speaker.trim() : null,
      speed: normalizeSpeed(payload.speed),
    };
    const cacheKey = createCacheKey(request);
    const cached = this.readCache(cacheKey);
    if (cached) {
      return {
        provider: PROVIDER_NAME,
        language: cached.language,
        speaker: cached.speaker,
        audioBuffer: Buffer.from(cached.audioBuffer),
        cached: true,
      };
    }

    const response = await this.request('synthesize', request);
    const audioBuffer = Buffer.from(response.audioBase64, 'base64');
    const result = {
      provider: PROVIDER_NAME,
      language: response.language || request.language,
      speaker: response.speaker || request.speaker || '',
      audioBuffer,
      cached: false,
    };

    this.writeCache(cacheKey, result);
    return result;
  }

  async warmUp(language = DEFAULT_LANGUAGE) {
    return this.request('warmup', { language: normalizeLanguage(language) });
  }

  async health({ warm = false, language = DEFAULT_LANGUAGE } = {}) {
    if (!isEnabled()) {
      return {
        provider: PROVIDER_NAME,
        enabled: false,
        status: 'disabled',
        pythonCommand: PYTHON_COMMAND,
        processActive: false,
        cachedItems: this.cache.size,
        lastError: this.lastError,
      };
    }

    if (warm) {
      const response = await this.request('warmup', { language: normalizeLanguage(language) });
      return {
        provider: PROVIDER_NAME,
        enabled: true,
        status: 'ready',
        pythonCommand: PYTHON_COMMAND,
        processActive: Boolean(this.child),
        cachedItems: this.cache.size,
        lastError: this.lastError,
        language: response.language,
        speakers: response.speakers,
      };
    }

    if (!this.child) {
      return {
        provider: PROVIDER_NAME,
        enabled: true,
        status: 'idle',
        pythonCommand: PYTHON_COMMAND,
        processActive: false,
        cachedItems: this.cache.size,
        lastError: this.lastError,
      };
    }

    const response = await this.request('health', { language: normalizeLanguage(language) });
    return {
      provider: PROVIDER_NAME,
      enabled: true,
      status: response.ready ? 'ready' : 'starting',
      pythonCommand: PYTHON_COMMAND,
      processActive: true,
      cachedItems: this.cache.size,
      lastError: this.lastError,
      language: response.language,
      speakers: response.speakers,
    };
  }

  async request(action, payload) {
    if (!isEnabled()) {
      throw new Error('Natural voice is disabled by TTS_ENABLED=false.');
    }

    const child = await this.ensureChild();
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Natural voice request timed out after ${REQUEST_TIMEOUT_MS}ms.`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeoutHandle);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
      });

      try {
        child.stdin.write(`${JSON.stringify({ id, action, ...payload })}\n`);
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  async ensureChild() {
    if (this.child && !this.child.killed) {
      return this.child;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = new Promise((resolve, reject) => {
      const child = spawn(PYTHON_COMMAND, [TTS_SERVICE_SCRIPT], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HTTP_PROXY: '',
          HTTPS_PROXY: '',
          ALL_PROXY: '',
          http_proxy: '',
          https_proxy: '',
          all_proxy: '',
          NO_PROXY: '*',
          no_proxy: '*',
          PYTHONIOENCODING: 'utf-8',
        },
      });

      let settled = false;

      const finalizeResolve = () => {
        if (settled) return;
        settled = true;
        this.child = child;
        this.startPromise = null;
        resolve(child);
      };

      const finalizeReject = (error) => {
        if (settled) return;
        settled = true;
        this.startPromise = null;
        reject(error);
      };

      child.once('spawn', finalizeResolve);
      child.once('error', (error) => {
        this.lastError = error.message;
        finalizeReject(error);
      });

      this.stdoutReader = readline.createInterface({ input: child.stdout });
      this.stdoutReader.on('line', (line) => {
        this.handleMessageLine(line);
      });

      child.stderr.on('data', (chunk) => {
        this.captureStderr(chunk.toString());
      });

      child.on('close', (code) => {
        const stderrSummary = this.stderrHistory.join(' ').trim();
        const message =
          code === 0
            ? 'Natural voice service stopped.'
            : [stderrSummary, `Natural voice service exited with code ${code}.`].filter(Boolean).join(' ');
        this.lastError = message;
        this.rejectAllPending(new Error(message));
        this.child = null;
        this.startPromise = null;
        if (this.stdoutReader) {
          this.stdoutReader.removeAllListeners();
          this.stdoutReader.close();
          this.stdoutReader = null;
        }
      });
    });

    return this.startPromise;
  }

  handleMessageLine(line) {
    if (!line.trim()) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(line);
    } catch (error) {
      this.lastError = `Natural voice service returned invalid JSON. ${error.message}`;
      return;
    }

    const pendingRequest = this.pending.get(payload.id);
    if (!pendingRequest) {
      return;
    }

    this.pending.delete(payload.id);

    if (!payload.success) {
      const details = typeof payload.details === 'string' && payload.details ? ` ${payload.details}` : '';
      pendingRequest.reject(new Error(`${payload.message || 'Natural voice request failed.'}${details}`.trim()));
      return;
    }

    pendingRequest.resolve(payload);
  }

  rejectAllPending(error) {
    for (const [id, pendingRequest] of this.pending.entries()) {
      this.pending.delete(id);
      pendingRequest.reject(error);
    }
  }

  captureStderr(rawChunk) {
    const text = rawChunk
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!text.length) {
      return;
    }

    this.stderrHistory.push(...text);
    this.stderrHistory = this.stderrHistory.slice(-20);
  }

  readCache(key) {
    const value = this.cache.get(key);
    if (!value) {
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  writeCache(key, value) {
    this.cache.set(key, {
      language: value.language,
      speaker: value.speaker,
      audioBuffer: Buffer.from(value.audioBuffer),
    });

    while (this.cache.size > CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

const provider = new MeloTtsBridge();

module.exports = {
  getTtsProvider: () => provider,
  getTtsProviderName: () => PROVIDER_NAME,
  normalizeTtsLanguage: normalizeLanguage,
};
