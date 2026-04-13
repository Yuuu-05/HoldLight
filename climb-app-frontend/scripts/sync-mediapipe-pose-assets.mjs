import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const packageRoot = path.join(projectRoot, 'node_modules', '@mediapipe', 'pose');
const targetRoot = path.join(projectRoot, 'public', 'vendor', 'mediapipe', 'pose');

const assetFiles = [
  'pose.js',
  'pose_landmark_full.tflite',
  'pose_landmark_heavy.tflite',
  'pose_landmark_lite.tflite',
  'pose_solution_packed_assets.data',
  'pose_solution_packed_assets_loader.js',
  'pose_solution_simd_wasm_bin.data',
  'pose_solution_simd_wasm_bin.js',
  'pose_solution_simd_wasm_bin.wasm',
  'pose_solution_wasm_bin.js',
  'pose_solution_wasm_bin.wasm',
  'pose_web.binarypb',
];

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyAsset(filename) {
  const sourcePath = path.join(packageRoot, filename);
  const targetPath = path.join(targetRoot, filename);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing MediaPipe Pose asset: ${sourcePath}`);
  }

  fs.copyFileSync(sourcePath, targetPath);
}

function main() {
  if (!fs.existsSync(packageRoot)) {
    console.warn('[sync-mediapipe-pose-assets] @mediapipe/pose is not installed. Skipping local asset sync.');
    return;
  }

  ensureDirectory(targetRoot);
  for (const filename of assetFiles) {
    copyAsset(filename);
  }

  console.log(`[sync-mediapipe-pose-assets] Synced ${assetFiles.length} MediaPipe Pose assets.`);
}

main();
