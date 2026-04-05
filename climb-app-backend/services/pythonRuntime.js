const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.join(__dirname, '..', '..');

function buildVenvPythonCandidates(venvNames) {
  return venvNames.flatMap((venvName) => [
    path.join(WORKSPACE_ROOT, venvName, 'Scripts', 'python.exe'),
    path.join(WORKSPACE_ROOT, venvName, 'bin', 'python'),
  ]);
}

function resolvePythonCommand(envVarName, preferredVenvNames = []) {
  const override = process.env[envVarName]?.trim();
  if (override) {
    return override;
  }

  return buildVenvPythonCandidates(preferredVenvNames).find((candidate) => fs.existsSync(candidate)) || 'python';
}

module.exports = {
  WORKSPACE_ROOT,
  resolvePythonCommand,
};
