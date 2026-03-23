import { useCallback, useState } from 'react';
import { saveClimbScanApi } from '../../../shared/api/climbing.api';
import { runVisionFullApi } from '../../../shared/api/vision.api';
import type { ClimbScan } from '../../../shared/types/climb';
import type { ScanProgress } from '../types';
import { buildScanPayload, buildScanPayloadFromWallMap } from '../services/scan.service';

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface StartScanOptions {
  source?: 'camera' | 'demo';
  gymName?: string;
  videoElement?: HTMLVideoElement | null;
  imageElement?: HTMLImageElement | null;
  uploadedVideoElement?: HTMLVideoElement | null;
  uploadType?: 'image' | 'video' | null;
}

interface CaptureOptions {
  maxDimension?: number;
  quality?: number;
}

function captureElementPreview(element: HTMLVideoElement | HTMLImageElement | null, options: CaptureOptions = {}) {
  if (!element) return undefined;

  const sourceWidth = 'videoWidth' in element ? element.videoWidth : element.naturalWidth;
  const sourceHeight = 'videoHeight' in element ? element.videoHeight : element.naturalHeight;

  if (!sourceWidth || !sourceHeight) return undefined;

  const maxDimension = options.maxDimension ?? Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  context.drawImage(element, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', options.quality ?? 0.88);
}

function buildCompletionMessage(scan: ClimbScan) {
  const analysis = scan.wallMap.analysis;

  if (!analysis) {
    return `Wall scan complete. ${scan.wallMap.holds.length} holds and ${scan.availableColors.length} route colors are ready for route setup.`;
  }

  if (analysis.shouldAllowAutonomousGuidance) {
    return `The wall looks clear enough for route setup. ${analysis.detectionSummary.holdCount} holds and ${analysis.detectionSummary.routeCount} route candidates passed the accessibility gate.`;
  }

  if (analysis.suggestedAction === 'companion') {
    return 'Recognition is partly stable, but companion mode will keep the next step safer.';
  }

  return 'Recognition confidence is still low for autonomous guidance. Please retake the photo or try a clearer angle.';
}

export function useScanSession() {
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    status: 'idle',
    progress: 0,
    message: 'Ready to scan the wall.',
    error: null,
  });
  const [latestScan, setLatestScan] = useState<ClimbScan | null>(null);

  const startScan = useCallback(async ({
    source = 'demo',
    gymName,
    videoElement,
    imageElement,
    uploadedVideoElement,
    uploadType,
  }: StartScanOptions = {}) => {
    try {
      let payload;

      if (source === 'camera') {
        if (!videoElement) {
          throw new Error('The live camera preview is not ready yet.');
        }

        setScanProgress({ status: 'scanning', progress: 8, message: 'Capturing a calm wall frame from the live camera.', error: null });
        const inferenceImage = captureElementPreview(videoElement, { maxDimension: 1280, quality: 0.84 });
        const previewImage = captureElementPreview(videoElement, { maxDimension: 640, quality: 0.58 });
        if (!inferenceImage || !previewImage) {
          throw new Error('The live camera frame could not be captured yet.');
        }
        setScanProgress({ status: 'scanning', progress: 38, message: 'Handing the frame over to route recognition.', error: null });
        const result = await runVisionFullApi({
          imageDataUrl: inferenceImage,
          source: 'camera',
          gymName,
          filename: 'camera-capture.jpg',
        });
        const wallMap = result.wallMap;
        setScanProgress({ status: 'saving', progress: 86, message: 'Saving the scanned wall map for the next step.', error: null });
        payload = buildScanPayloadFromWallMap(wallMap, gymName, previewImage);
      } else if (uploadType === 'image') {
        if (!imageElement) {
          throw new Error('The uploaded image preview is not ready yet.');
        }

        setScanProgress({ status: 'scanning', progress: 8, message: 'Preparing the uploaded wall photo.', error: null });
        const inferenceImage = captureElementPreview(imageElement, { maxDimension: 1280, quality: 0.84 });
        const previewImage = captureElementPreview(imageElement, { maxDimension: 640, quality: 0.56 });
        if (!inferenceImage || !previewImage) {
          throw new Error('The uploaded image preview is not ready yet.');
        }
        setScanProgress({ status: 'scanning', progress: 38, message: 'Sending the wall photo to route recognition.', error: null });
        const result = await runVisionFullApi({
          imageDataUrl: inferenceImage,
          source: 'upload',
          gymName,
          filename: 'uploaded-wall-photo.jpg',
        });
        const wallMap = result.wallMap;
        setScanProgress({ status: 'saving', progress: 86, message: 'Saving the uploaded wall map.', error: null });
        payload = buildScanPayloadFromWallMap(wallMap, gymName, previewImage);
      } else if (uploadType === 'video') {
        if (!uploadedVideoElement) {
          throw new Error('The uploaded video preview is not ready yet.');
        }

        setScanProgress({ status: 'scanning', progress: 8, message: 'Capturing a clear frame from the uploaded video.', error: null });
        const inferenceImage = captureElementPreview(uploadedVideoElement, { maxDimension: 1280, quality: 0.84 });
        const previewImage = captureElementPreview(uploadedVideoElement, { maxDimension: 640, quality: 0.58 });
        if (!inferenceImage || !previewImage) {
          throw new Error('Pause the uploaded video on a clear wall frame before scanning.');
        }
        setScanProgress({ status: 'scanning', progress: 38, message: 'Sending the captured frame to route recognition.', error: null });
        const result = await runVisionFullApi({
          imageDataUrl: inferenceImage,
          source: 'upload',
          gymName,
          filename: 'uploaded-video-frame.jpg',
        });
        const wallMap = result.wallMap;
        setScanProgress({ status: 'saving', progress: 86, message: 'Saving the uploaded wall map.', error: null });
        payload = buildScanPayloadFromWallMap(wallMap, gymName, previewImage);
      } else {
        setScanProgress({ status: 'scanning', progress: 10, message: 'Loading the demo wall map.', error: null });
        await delay(200);
        setScanProgress({ status: 'saving', progress: 82, message: 'Saving the demo wall map.', error: null });
        payload = buildScanPayload(source, gymName);
      }

      const scan = await saveClimbScanApi(payload);
      setLatestScan(scan);
      setScanProgress({
        status: 'done',
        progress: 100,
        message: buildCompletionMessage(scan),
        error: null,
      });
      return scan;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to scan the wall.';
      setScanProgress({ status: 'error', progress: 0, message: 'We could not finish this scan.', error: message });
      return null;
    }
  }, []);

  return {
    scanProgress,
    latestScan,
    startScan,
  };
}
