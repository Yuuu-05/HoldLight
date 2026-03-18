const express = require('express');
const { getVisionProvider, runVisionInference } = require('../services/visionProvider');

const router = express.Router();

function validateRequest(body) {
  if (!body || typeof body.imageDataUrl !== 'string' || !body.imageDataUrl.startsWith('data:image/')) {
    return 'A base64 data URL image is required.';
  }

  if (body.source && !['camera', 'upload'].includes(body.source)) {
    return 'Source must be either "camera" or "upload".';
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

router.get('/health', (_req, res) => {
  try {
    const provider = getVisionProvider();
    return res.json({ success: true, provider: provider.name, status: 'ok' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/infer/holds', async (req, res) => handleInference(req, res, 'holds'));
router.post('/infer/routes', async (req, res) => handleInference(req, res, 'routes'));
router.post('/infer/full', async (req, res) => handleInference(req, res, 'full'));

module.exports = router;
