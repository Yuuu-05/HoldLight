const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..');
const WORKSPACE_ROOT = path.join(BACKEND_ROOT, '..');

function buildVenvPythonCandidates(venvNames) {
  const roots = [BACKEND_ROOT, WORKSPACE_ROOT];
  return roots.flatMap((root) =>
    venvNames.flatMap((venvName) => [
      path.join(root, venvName, 'Scripts', 'python.exe'),
      path.join(root, venvName, 'bin', 'python'),
    ]),
  );
}

function resolvePythonCommand(envVarName, preferredVenvNames = []) {
  const override = process.env[envVarName]?.trim();
  if (override) {
    return override;
  }

  return buildVenvPythonCandidates(preferredVenvNames).find((candidate) => fs.existsSync(candidate)) || 'python';
}

module.exports = {
  BACKEND_ROOT,
  WORKSPACE_ROOT,
  resolvePythonCommand,
};
