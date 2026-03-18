const path = require('path');
const { spawn } = require('child_process');

const PYTHON_COMMAND = process.env.VISION_PYTHON_COMMAND || 'python';
const PROVIDER_NAMES = {
  auto: 'python-auto',
  heuristic: 'python-opencv-heuristic',
  xiaoxiae: 'xiaoxiae-detectron2-triplet',
};

function normalizeProviderMode(value) {
  const normalized = (value || 'auto').trim().toLowerCase();

  if (['auto', 'python-auto'].includes(normalized)) return 'auto';
  if (['python-opencv', 'opencv', 'heuristic'].includes(normalized)) return 'heuristic';
  if (['xiaoxiae', 'python-xiaoxiae'].includes(normalized)) return 'xiaoxiae';
  throw new Error(`Unsupported VISION_PROVIDER "${value}".`);
}

function runPythonInference(payload, providerMode) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'vision_service', 'infer.py');
    const child = spawn(PYTHON_COMMAND, [scriptPath], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        VISION_PROVIDER_MODE: providerMode,
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Vision provider exited with code ${code}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        if (!parsed.success) {
          reject(new Error(parsed.message || 'Vision inference failed.'));
          return;
        }
        resolve(parsed.result);
      } catch (error) {
        reject(new Error(`Vision provider returned invalid JSON. ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function getVisionProvider() {
  const providerMode = normalizeProviderMode(process.env.VISION_PROVIDER || 'auto');
  return {
    name: PROVIDER_NAMES[providerMode],
    infer: (payload) => runPythonInference(payload, providerMode),
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

module.exports = {
  getVisionProvider,
  runVisionInference,
};
