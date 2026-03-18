const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ClimbScan = require('../models/ClimbScan');

router.post('/', auth, async (req, res) => {
  try {
    const { gymName, availableColors, wallMap, coverImageUrl } = req.body;

    if (!wallMap || !Array.isArray(wallMap.holds) || wallMap.holds.length === 0) {
      return res.status(400).json({ success: false, message: 'A wall map with at least one hold is required.' });
    }

    const scan = await ClimbScan.create({
      userId: req.user.id,
      gymName: gymName?.trim() || 'Unknown gym',
      availableColors: Array.isArray(availableColors) ? availableColors : wallMap.colors || [],
      wallMap,
      coverImageUrl: coverImageUrl || '',
    });

    return res.status(201).json({ success: true, scan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/latest/me', auth, async (req, res) => {
  try {
    const scan = await ClimbScan.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ success: true, scan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const scans = await ClimbScan.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    return res.json({ success: true, scans });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const scan = await ClimbScan.findOne({ _id: req.params.id, userId: req.user.id });

    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found.' });
    }

    return res.json({ success: true, scan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { gymName, availableColors, wallMap, coverImageUrl } = req.body;
    const updates = {};

    if (typeof gymName === 'string') updates.gymName = gymName.trim() || 'Unknown gym';
    if (Array.isArray(availableColors)) updates.availableColors = availableColors;
    if (wallMap) updates.wallMap = wallMap;
    if (typeof coverImageUrl === 'string') updates.coverImageUrl = coverImageUrl;

    if (wallMap && (!Array.isArray(wallMap.holds) || wallMap.holds.length === 0)) {
      return res.status(400).json({ success: false, message: 'A wall map with at least one hold is required.' });
    }

    const scan = await ClimbScan.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updates,
      { new: true },
    );

    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found.' });
    }

    return res.json({ success: true, scan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
