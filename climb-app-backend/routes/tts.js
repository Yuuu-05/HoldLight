const express = require('express');
const { getTtsProvider, normalizeTtsLanguage } = require('../services/ttsProvider');

const router = express.Router();

function parseLanguage(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  return normalizeTtsLanguage(value);
}

router.get('/health', async (req, res) => {
  try {
    const provider = getTtsProvider();
    const result = await provider.health({
      warm: ['1', 'true', 'yes', 'on'].includes(String(req.query.warm ?? '').trim().toLowerCase()),
      language: parseLanguage(req.query.language) || undefined,
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message || 'Natural voice service is unavailable.' });
  }
});

router.post('/speak', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    return res.status(400).json({ success: false, message: 'Text is required for speech synthesis.' });
  }

  try {
    const provider = getTtsProvider();
    const result = await provider.synthesize({
      text,
      language: parseLanguage(req.body.language),
      speaker: typeof req.body.speaker === 'string' ? req.body.speaker : undefined,
      speed: req.body.speed,
    });

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': String(result.audioBuffer.length),
      'Cache-Control': 'no-store',
      'X-TTS-Provider': result.provider,
      'X-TTS-Language': result.language,
      'X-TTS-Speaker': result.speaker,
      'X-TTS-Cached': result.cached ? '1' : '0',
    });

    return res.send(result.audioBuffer);
  } catch (error) {
    console.error('TTS speak failed:', error.message);
    return res.status(503).json({ success: false, message: error.message || 'Natural voice service is unavailable.' });
  }
});

module.exports = router;
