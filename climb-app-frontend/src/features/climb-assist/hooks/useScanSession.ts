import { useCallback, useEffect, useState } from 'react';
import { saveClimbScanApi } from '../../../shared/api/climbing.api';
import { runVisionFullApi } from '../../../shared/api/vision.api';
import type { ClimbScan } from '../../../shared/types/climb';
import type { ScanProgress } from '../types';
import { buildScanPayloadFromWallMap } from '../services/scan.service';

interface StartScanOptions {
  source?: 'camera';
  gymName?: string;
  videoElement?: HTMLVideoElement | null;
  imageElement?: HTMLImageElement | null;
  uploadedVideoElement?: HTMLVideoElement | null;
  uploadType?: 'image' | 'video' | null;
}

interface CaptureOptions {
  maxDimension?: number;
  quality?: number;
  maxDataUrlLength?: number;
  targetAspectRatio?: number;
}

const IPHONE_REAR_CAMERA_ASPECT_RATIO = 3 / 4;

function getCenteredSourceCrop(sourceWidth: number, sourceHeight: number, targetAspectRatio?: number) {
  if (!targetAspectRatio || !Number.isFinite(targetAspectRatio) || targetAspectRatio <= 0) {
    return {
      sx: 0,
      sy: 0,
      sw: sourceWidth,
      sh: sourceHeight,
    };
  }

  const sourceAspectRatio = sourceWidth / sourceHeight;

  if (sourceAspectRatio > targetAspectRatio) {
    const cropWidth = sourceHeight * targetAspectRatio;
    return {
      sx: (sourceWidth - cropWidth) / 2,
      sy: 0,
      sw: cropWidth,
      sh: sourceHeight,
    };
  }

  const cropHeight = sourceWidth / targetAspectRatio;
  return {
    sx: 0,
    sy: (sourceHeight - cropHeight) / 2,
    sw: sourceWidth,
    sh: cropHeight,
  };
}

function captureElementPreview(element: HTMLVideoElement | HTMLImageElement | null, options: CaptureOptions = {}) {
  if (!element) return undefined;

  const sourceWidth = 'videoWidth' in element ? element.videoWidth : element.naturalWidth;
  const sourceHeight = 'videoHeight' in element ? element.videoHeight : element.naturalHeight;

  if (!sourceWidth || !sourceHeight) return undefined;

  const crop = getCenteredSourceCrop(sourceWidth, sourceHeight, options.targetAspectRatio);
  const maxDimension = options.maxDimension ?? Math.max(crop.sw, crop.sh);
  const scale = Math.min(1, maxDimension / Math.max(crop.sw, crop.sh));
  const width = Math.max(1, Math.round(crop.sw * scale));
  const height = Math.max(1, Math.round(crop.sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  context.drawImage(element, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);

  const initialQuality = options.quality ?? 0.88;
  const maxDataUrlLength = options.maxDataUrlLength;
  let nextQuality = initialQuality;
  let output = canvas.toDataURL('image/jpeg', nextQuality);

  if (!maxDataUrlLength || output.length <= maxDataUrlLength) {
    return output;
  }

  while (output.length > maxDataUrlLength && nextQuality > 0.4) {
    nextQuality = Number((nextQuality - 0.08).toFixed(2));
    output = canvas.toDataURL('image/jpeg', nextQuality);
  }

  if (output.length <= maxDataUrlLength) {
    return output;
  }

  let shrinkScale = 0.88;
  while (output.length > maxDataUrlLength && width * shrinkScale >= 320 && height * shrinkScale >= 240) {
    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = Math.max(1, Math.round(width * shrinkScale));
    nextCanvas.height = Math.max(1, Math.round(height * shrinkScale));
    const nextContext = nextCanvas.getContext('2d');
    if (!nextContext) break;

    nextContext.drawImage(canvas, 0, 0, width, height, 0, 0, nextCanvas.width, nextCanvas.height);
    output = nextCanvas.toDataURL('image/jpeg', Math.max(0.42, nextQuality));
    shrinkScale -= 0.08;
  }

  return output;
}

function buildCompletionMessage(scan: ClimbScan) {
  const analysis = scan.wallMap.analysis;

  if (!analysis) {
    return `Wall scan complete. ${scan.wallMap.holds.length} holds and ${scan.availableColors.length} route colors are ready for route setup.`;
  }

  if (analysis.shouldAllowAutonomousGuidance) {
    return `The wall looks ready. ${analysis.detectionSummary.holdCount} holds and ${analysis.detectionSummary.routeCount} route options were found.`;
  }

  if (analysis.suggestedAction === 'companion') {
    return 'Recognition is partly stable, but companion mode will keep the next step safer.';
  }

  return 'Recognition is not clear enough yet. Retake the photo or try a clearer angle.';
}

export function useScanSession() {
  const initialScanProgress: ScanProgress = {
    status: 'idle',
    progress: 0,
    message: 'Ready to scan the wall.',
    error: null,
  };
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    ...initialScanProgress,
  });
  const [latestScan, setLatestScan] = useState<ClimbScan | null>(null);

  useEffect(() => {
    if (scanProgress.status !== 'scanning' && scanProgress.status !== 'saving') {
      return undefined;
    }

    const step = scanProgress.status === 'scanning' ? 2 : 1;
    const timer = window.setInterval(() => {
      setScanProgress((current) => {
        if (current.status !== 'scanning' && current.status !== 'saving') {
          return current;
        }

        const nextCeiling = current.status === 'scanning' ? 82 : 96;
        const nextStep = current.status === 'scanning' ? step : 1;
        if (current.progress >= nextCeiling) {
          return current;
        }

        return {
          ...current,
          progress: Math.min(nextCeiling, current.progress + nextStep),
        };
      });
    }, scanProgress.status === 'scanning' ? 650 : 500);

    return () => window.clearInterval(timer);
  }, [scanProgress.status]);

  const startScan = useCallback(async ({
    source = 'camera',
    gymName,
    videoElement,
    imageElement,
    uploadedVideoElement,
    uploadType,
  }: StartScanOptions = {}) => {
    try {
      let payload;

      if (uploadType === 'image') {
        if (!imageElement) {
          throw new Error('The uploaded image preview is not ready yet.');
        }

        setScanProgress({ status: 'scanning', progress: 8, message: 'Preparing the uploaded wall photo.', error: null });
        const inferenceImage = captureElementPreview(imageElement, {
          maxDimension: 1280,
          quality: 0.84,
          targetAspectRatio: IPHONE_REAR_CAMERA_ASPECT_RATIO,
        });
        const previewImage = captureElementPreview(imageElement, {
          maxDimension: 640,
          quality: 0.56,
          maxDataUrlLength: 190_000,
          targetAspectRatio: IPHONE_REAR_CAMERA_ASPECT_RATIO,
        });
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
        const inferenceImage = captureElementPreview(uploadedVideoElement, {
          maxDimension: 1280,
          quality: 0.84,
          targetAspectRatio: IPHONE_REAR_CAMERA_ASPECT_RATIO,
        });
        const previewImage = captureElementPreview(uploadedVideoElement, {
          maxDimension: 640,
          quality: 0.58,
          maxDataUrlLength: 190_000,
          targetAspectRatio: IPHONE_REAR_CAMERA_ASPECT_RATIO,
        });
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
      } else if (source === 'camera') {
        if (!videoElement) {
          throw new Error('The live camera preview is not ready yet.');
        }

        setScanProgress({ status: 'scanning', progress: 8, message: 'Capturing a calm wall frame from the live camera.', error: null });
        const inferenceImage = captureElementPreview(videoElement, {
          maxDimension: 1280,
          quality: 0.84,
          targetAspectRatio: IPHONE_REAR_CAMERA_ASPECT_RATIO,
        });
        const previewImage = captureElementPreview(videoElement, {
          maxDimension: 640,
          quality: 0.58,
          maxDataUrlLength: 190_000,
          targetAspectRatio: IPHONE_REAR_CAMERA_ASPECT_RATIO,
        });
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
      } else {
        throw new Error('Choose a live camera scan or upload a wall image or video to continue.');
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

  const resetScanSession = useCallback(() => {
    setLatestScan(null);
    setScanProgress(initialScanProgress);
  }, []);

  return {
    scanProgress,
    latestScan,
    startScan,
    resetScanSession,
  };
}
