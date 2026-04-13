const express = require('express');
const { getVisionProvider, runVisionInference, runVisionCalibration } = require('../services/visionProvider');
const auth = require('../middleware/auth');
const { buildRateLimiterFromEnv } = require('../middleware/rateLimit');

const router = express.Router();
const getActorKey = (req) => req.user?.id || req.ip || 'anonymous';
const isEnabled = (value) => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
const ALLOW_PUBLIC_HEALTH_WARM = isEnabled(process.env.VISION_ALLOW_PUBLIC_WARM_HEALTH);
const visionInferenceLimiter = buildRateLimiterFromEnv({
  envPrefix: 'VISION_RATE_LIMIT',
  defaultWindowMs: 60_000,
  defaultMaxRequests: 10,
  keyPrefix: 'vision-infer',
  keyFn: getActorKey,
  message: 'Too many wall scans are running right now. Please wait a moment and try again.',
});
const visionCalibrationLimiter = buildRateLimiterFromEnv({
  envPrefix: 'CALIBRATION_RATE_LIMIT',
  defaultWindowMs: 60_000,
  defaultMaxRequests: 45,
  keyPrefix: 'vision-calibration',
  keyFn: getActorKey,
  message: 'Wall alignment is being refreshed too often. Please hold the camera steady and try again.',
});

function validateRequest(body) {
  if (!body || typeof body.imageDataUrl !== 'string' || !body.imageDataUrl.startsWith('data:image/')) {
    return 'A base64 data URL image is required.';
  }

  if (body.source && !['camera', 'upload'].includes(body.source)) {
    return 'Source must be either "camera" or "upload".';
  }

  return null;
}

function validateCalibrationRequest(body) {
  if (!body || typeof body.referenceImageDataUrl !== 'string' || !body.referenceImageDataUrl.startsWith('data:image/')) {
    return 'A base64 data URL reference image is required.';
  }

  if (!body || typeof body.frameImageDataUrl !== 'string' || !body.frameImageDataUrl.startsWith('data:image/')) {
    return 'A base64 data URL live frame image is required.';
  }

  if (!body.wallMap || !Array.isArray(body.wallMap.holds) || body.wallMap.holds.length === 0) {
    return 'A wall map with at least one hold is required for planar calibration.';
  }

  return null;
}

async function handleInference(req, res, mode) {
  const validationError = validateRequest(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    const result = await runVisionInference({
      mode,
      imageDataUrl: req.body.imageDataUrl,
      source: req.body.source || 'upload',
      gymName: req.body.gymName || 'Unknown gym',
      filename: req.body.filename || '',
    });

    return res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || 'Vision inference failed.' });
  }
}

async function handleCalibration(req, res) {
  const validationError = validateCalibrationRequest(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    const result = await runVisionCalibration({
      referenceImageDataUrl: req.body.referenceImageDataUrl,
      frameImageDataUrl: req.body.frameImageDataUrl,
      wallMap: req.body.wallMap,
    });

    return res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || 'Vision calibration failed.' });
  }
}

router.get('/health', async (req, res) => {
  try {
    const warmRequested = isEnabled(req.query.warm);
    if (warmRequested && !ALLOW_PUBLIC_HEALTH_WARM) {
      return res.status(403).json({
        success: false,
        message: 'Public vision warm-up is disabled.',
      });
    }

    const provider = getVisionProvider();
    const result = await provider.health({
      warm: warmRequested,
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/infer/holds', auth, visionInferenceLimiter, async (req, res) => handleInference(req, res, 'holds'));
router.post('/infer/routes', auth, visionInferenceLimiter, async (req, res) => handleInference(req, res, 'routes'));
router.post('/infer/full', auth, visionInferenceLimiter, async (req, res) => handleInference(req, res, 'full'));
router.post('/calibrate/planar', auth, visionCalibrationLimiter, handleCalibration);

module.exports = router;
