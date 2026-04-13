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

function parseWorkerCount(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, parsed);
}

function clampWarmCount(value, max, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return Math.min(max, fallback);
  return Math.max(0, Math.min(max, parsed));
}

class VisionWorker {
  constructor(poolName, index) {
    this.poolName = poolName;
    this.index = index;
    this.child = null;
    this.stdoutReader = null;
    this.pending = new Map();
    this.stderrHistory = [];
    this.lastError = '';
    this.startPromise = null;
    this.inflightCount = 0;
    this.lastHealth = null;
  }

  get label() {
    return `${this.poolName}-${this.index + 1}`;
  }

  getLoadScore() {
    return this.inflightCount + (this.startPromise ? 0.5 : 0);
  }

  getSnapshot() {
    return {
      worker: this.label,
      processActive: Boolean(this.child),
      starting: Boolean(this.startPromise),
      inflightCount: this.inflightCount,
      ready: Boolean(this.lastHealth?.ready),
      modelLoaded: Boolean(this.lastHealth?.modelLoaded),
      lastError: this.lastError,
    };
  }

  async ensureStarted() {
    await this.ensureChild();
    return this.getSnapshot();
  }

  async requestHealth({ warm = false, start = false } = {}) {
    if (!this.child && !this.startPromise && !warm && !start) {
      return this.getSnapshot();
    }

    if (start && !warm) {
      await this.ensureChild();
    }

    const response = await this.request('health', { warm });
    this.lastHealth = response;
    return {
      ...this.getSnapshot(),
      provider: response.provider || PROVIDER_NAME,
      runtime: response.runtime,
      ready: Boolean(response.ready),
      modelLoaded: Boolean(response.modelLoaded),
    };
  }

  async request(action, payload) {
    this.inflightCount += 1;

    let child;
    try {
      child = await this.ensureChild();
    } catch (error) {
      this.inflightCount = Math.max(0, this.inflightCount - 1);
      this.lastError = error.message;
      throw error;
    }

    return new Promise((resolve, reject) => {
      const id = randomUUID();
      let settled = false;

      const finalize = (handler, value) => {
        if (settled) return;
        settled = true;
        this.pending.delete(id);
        this.inflightCount = Math.max(0, this.inflightCount - 1);
        clearTimeout(timeoutHandle);
        handler(value);
      };

      const timeoutHandle = setTimeout(() => {
        finalize(reject, new Error(`Vision request timed out after ${REQUEST_TIMEOUT_MS}ms.`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (value) => finalize(resolve, value),
        reject: (error) => finalize(reject, error),
      });

      try {
        child.stdin.write(`${JSON.stringify({ id, action, ...payload })}\n`);
      } catch (error) {
        finalize(reject, error);
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
        this.lastHealth = null;
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
    const pendingRequests = Array.from(this.pending.values());
    for (const pending of pendingRequests) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

class VisionWorkerPool {
  constructor(poolName, workerCount) {
    this.poolName = poolName;
    this.workers = Array.from({ length: workerCount }, (_unused, index) => new VisionWorker(poolName, index));
  }

  ensureConfigured() {
    if (this.workers.length === 0) {
      throw new Error(`Vision worker pool "${this.poolName}" has no configured workers.`);
    }
  }

  selectWorker() {
    this.ensureConfigured();
    return this.workers.reduce((bestWorker, candidate) =>
      candidate.getLoadScore() < bestWorker.getLoadScore() ? candidate : bestWorker,
    );
  }

  buildSnapshot() {
    const workerSnapshots = this.workers.map((worker) => worker.getSnapshot());
    return {
      pool: this.poolName,
      workerCount: this.workers.length,
      activeWorkers: workerSnapshots.filter((worker) => worker.processActive).length,
      startingWorkers: workerSnapshots.filter((worker) => worker.starting).length,
      readyWorkers: workerSnapshots.filter((worker) => worker.ready).length,
      modelLoadedWorkers: workerSnapshots.filter((worker) => worker.modelLoaded).length,
      inflightRequests: workerSnapshots.reduce((sum, worker) => sum + worker.inflightCount, 0),
      lastError: workerSnapshots.map((worker) => worker.lastError).find(Boolean) || '',
      workers: workerSnapshots,
    };
  }

  async request(action, payload) {
    return this.selectWorker().request(action, payload);
  }

  async startWorkers(count) {
    const targets = this.workers.slice(0, clampWarmCount(String(count), this.workers.length, this.workers.length));
    await Promise.all(targets.map((worker) => worker.ensureStarted()));
    return this.buildSnapshot();
  }

  async warmWorkers(count) {
    const targets = this.workers.slice(0, clampWarmCount(String(count), this.workers.length, this.workers.length));
    await Promise.all(targets.map((worker) => worker.requestHealth({ warm: true })));
    return this.buildSnapshot();
  }
}

const INFERENCE_WORKER_COUNT = parseWorkerCount(process.env.VISION_INFER_WORKERS, 1);
const CALIBRATION_WORKER_COUNT = parseWorkerCount(process.env.VISION_CALIBRATION_WORKERS, 2);
const WARM_INFERENCE_WORKER_COUNT = clampWarmCount(
  process.env.VISION_WARM_INFER_WORKERS,
  INFERENCE_WORKER_COUNT,
  1,
);
const BOOT_CALIBRATION_WORKER_COUNT = clampWarmCount(
  process.env.VISION_BOOT_CALIBRATION_WORKERS,
  CALIBRATION_WORKER_COUNT,
  1,
);

const inferencePool = new VisionWorkerPool('inference', INFERENCE_WORKER_COUNT);
const calibrationPool = new VisionWorkerPool('calibration', CALIBRATION_WORKER_COUNT);

function buildProviderHealthStatus() {
  const inference = inferencePool.buildSnapshot();
  const calibration = calibrationPool.buildSnapshot();
  const processActive = inference.activeWorkers > 0 || calibration.activeWorkers > 0;
  const starting = inference.startingWorkers > 0 || calibration.startingWorkers > 0;
  const ready = inference.readyWorkers > 0 && (calibration.workerCount === 0 || calibration.activeWorkers > 0);

  return {
    provider: PROVIDER_NAME,
    status: ready ? 'ready' : starting || processActive ? 'starting' : 'idle',
    ready,
    modelLoaded: inference.modelLoadedWorkers > 0,
    processActive,
    pythonCommand: PYTHON_COMMAND,
    workerPools: {
      inference,
      calibration,
    },
    lastError: [inference.lastError, calibration.lastError].find(Boolean) || '',
  };
}

async function warmVisionRuntime() {
  await Promise.all([
    inferencePool.warmWorkers(WARM_INFERENCE_WORKER_COUNT),
    calibrationPool.startWorkers(BOOT_CALIBRATION_WORKER_COUNT),
  ]);

  return buildProviderHealthStatus();
}

async function getVisionHealth({ warm = false } = {}) {
  if (warm) {
    return warmVisionRuntime();
  }

  return buildProviderHealthStatus();
}

function getVisionProvider() {
  return {
    name: PROVIDER_NAME,
    infer: (payload) => inferencePool.request('infer', payload),
    calibrate: (payload) => calibrationPool.request('calibrate', payload),
    health: (options) => getVisionHealth(options),
    warmUp: () => warmVisionRuntime(),
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

module.exports = {
  getVisionProvider,
  runVisionInference,
  runVisionCalibration,
  warmVisionRuntime,
};
