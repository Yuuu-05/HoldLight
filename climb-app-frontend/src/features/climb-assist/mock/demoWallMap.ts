import type { Hold, HoldColor, WallMap } from '../../../shared/types/climb';

const demoHolds: Hold[] = [
  { id: 'blue-1', label: 'Blue start left', color: 'blue', xPct: 22, yPct: 84, confidence: 0.96, role: 'start', size: 'l' },
  { id: 'blue-2', label: 'Blue step right', color: 'blue', xPct: 38, yPct: 73, confidence: 0.95, role: 'foot', size: 'm' },
  { id: 'blue-3', label: 'Blue center jug', color: 'blue', xPct: 48, yPct: 60, confidence: 0.97, role: 'intermediate', size: 'l' },
  { id: 'blue-4', label: 'Blue side pull', color: 'blue', xPct: 62, yPct: 46, confidence: 0.94, role: 'intermediate', size: 'm' },
  { id: 'blue-5', label: 'Blue finish', color: 'blue', xPct: 55, yPct: 20, confidence: 0.98, role: 'finish', size: 'l' },

  { id: 'green-1', label: 'Green matched start', color: 'green', xPct: 68, yPct: 86, confidence: 0.95, role: 'start', size: 'm' },
  { id: 'green-2', label: 'Green balance hold', color: 'green', xPct: 57, yPct: 72, confidence: 0.94, role: 'intermediate', size: 'm' },
  { id: 'green-3', label: 'Green edge', color: 'green', xPct: 70, yPct: 58, confidence: 0.93, role: 'intermediate', size: 's' },
  { id: 'green-4', label: 'Green finish', color: 'green', xPct: 76, yPct: 30, confidence: 0.96, role: 'finish', size: 'm' },

  { id: 'red-1', label: 'Red low crimp', color: 'red', xPct: 18, yPct: 78, confidence: 0.92, role: 'start', size: 's' },
  { id: 'red-2', label: 'Red tension hold', color: 'red', xPct: 28, yPct: 64, confidence: 0.91, role: 'intermediate', size: 's' },
  { id: 'red-3', label: 'Red cross move', color: 'red', xPct: 19, yPct: 45, confidence: 0.9, role: 'intermediate', size: 's' },
  { id: 'red-4', label: 'Red finish', color: 'red', xPct: 30, yPct: 18, confidence: 0.94, role: 'finish', size: 's' },

  { id: 'yellow-1', label: 'Yellow foothold', color: 'yellow', xPct: 44, yPct: 88, confidence: 0.9, role: 'foot', size: 's' },
  { id: 'purple-1', label: 'Purple side hold', color: 'purple', xPct: 82, yPct: 67, confidence: 0.89, role: 'intermediate', size: 'm' },
];

export const availableDemoColors: HoldColor[] = ['blue', 'green', 'red', 'yellow', 'purple'];

export function buildDemoWallMap(source: 'camera' | 'demo' = 'demo'): WallMap {
  return {
    id: `wall_${Date.now()}`,
    name: source === 'camera' ? 'Scanned climbing wall' : 'Demo climbing wall',
    source,
    width: 100,
    height: 100,
    colors: availableDemoColors,
    scannedAt: new Date().toISOString(),
    scanNotes: [
      'Hold positions are normalized to a 2D wall map for the MVP.',
      'Real detector, color classifier, and pose tracker can replace this demo source later.',
    ],
    holds: demoHolds,
  };
}
