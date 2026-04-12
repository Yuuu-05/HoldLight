const path = require('path');
const readline = require('readline');
const { randomUUID } = require('crypto');
const { spawn } = require('child_process');
const { resolvePythonCommand } = require('./pythonRuntime');

const PYTHON_COMMAND = resolvePythonCommand('VISION_PYTHON_COMMAND', ['.venv', '.venv-1']);
const PROVIDER_NAME = 'xiaoxiae-detectron2-triplet';
const VISION_SERVICE_SCRIPT = path.join(__dirname, '..', 'vision_service', 'server.py');
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.VISION_REQUEST_TIMEOUT_MS || '120000', 10);

function normalizeProviderMode(value) {
  const normalized = (value || 'xiaoxiae').trim().toLowerCase();

  if (['auto', 'python-auto', 'xiaoxiae', 'python-xiaoxiae'].includes(normalized)) return 'xiaoxiae';
  throw new Error(`Unsupported VISION_PROVIDER "${value}". Only "xiaoxiae" is available now.`);
}

class VisionBridge {
  constructor() {
    this.child = null;
    this.stdoutReader = null;
    this.pending = new Map();
    this.stderrHistory = [];
    this.lastError = '';
    this.startPromise = null;
  }

  async infer(payload) {
    return this.request('infer', payload);
  }

  async calibrate(payload) {
    return this.request('calibrate', payload);
  }

  async warmUp() {
    return this.health({ warm: true });
  }

  async health({ warm = false } = {}) {
    if (!this.child && !warm) {
      return {
        provider: PROVIDER_NAME,
        status: 'idle',
        ready: false,
        modelLoaded: false,
        processActive: false,
        pythonCommand: PYTHON_COMMAND,
        lastError: this.lastError,
      };
    }

    const response = await this.request('health', { warm });
    return {
      provider: response.provider || PROVIDER_NAME,
      status: response.ready ? 'ready' : 'starting',
      ready: Boolean(response.ready),
      modelLoaded: Boolean(response.modelLoaded),
      processActive: Boolean(this.child),
      pythonCommand: PYTHON_COMMAND,
      runtime: response.runtime,
      lastError: this.lastError,
    };
  }

  async request(action, payload) {
    const child = await this.ensureChild();
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Vision request timed out after ${REQUEST_TIMEOUT_MS}ms.`));
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
      const child = spawn(PYTHON_COMMAND, [VISION_SERVICE_SCRIPT], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          VISION_PROVIDER_MODE: normalizeProviderMode(process.env.VISION_PROVIDER || 'xiaoxiae'),
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
            ? 'Vision service stopped.'
            : [stderrSummary, `Vision service exited with code ${code}.`].filter(Boolean).join(' ');
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
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (_error) {
      this.lastError = `Vision service returned invalid JSON: ${line}`;
      return;
    }

    const pendingRequest = parsed?.id ? this.pending.get(parsed.id) : null;
    if (!pendingRequest) {
      return;
    }

    this.pending.delete(parsed.id);
    if (!parsed.success) {
      pendingRequest.reject(new Error(parsed.message || 'Vision request failed.'));
      return;
    }

    pendingRequest.resolve(parsed.result);
  }

  captureStderr(chunk) {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    this.stderrHistory.push(trimmed);
    while (this.stderrHistory.length > 12) {
      this.stderrHistory.shift();
    }
  }

  rejectAllPending(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

const bridge = new VisionBridge();

function getVisionProvider() {
  return {
    name: PROVIDER_NAME,
    infer: (payload) => bridge.infer(payload),
    calibrate: (payload) => bridge.calibrate(payload),
    health: (options) => bridge.health(options),
    warmUp: () => bridge.warmUp(),
  };
}

async function runVisionInference(payload) {
  const provider = getVisionProvider();
  const result = await provider.infer(payload);
  return {
    provider: provider.name,
    ...result,
  };
}

async function runVisionCalibration(payload) {
  const provider = getVisionProvider();
  const result = await provider.calibrate(payload);
  return {
    provider: result.provider || 'python-opencv-planar-calibration',
    ...result,
  };
}

async function warmVisionRuntime() {
  const provider = getVisionProvider();
  return provider.warmUp();
}

module.exports = {
  getVisionProvider,
  runVisionInference,
  runVisionCalibration,
  warmVisionRuntime,
};
