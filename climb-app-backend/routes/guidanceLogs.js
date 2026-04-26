const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const GuidanceLog = require('../models/GuidanceLog');

router.post('/batch', auth, async (req, res) => {
  try {
    const { logs } = req.body;

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ success: false, message: 'A non-empty logs array is required.' });
    }

    const enrichedLogs = logs.map((log) => ({
      ...log,
      userId: req.user.id,
      timestamp: log.timestamp || new Date().toISOString(),
    }));

    const createdLogs = await GuidanceLog.insertMany(enrichedLogs);
    return res.status(201).json({ success: true, logs: createdLogs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
