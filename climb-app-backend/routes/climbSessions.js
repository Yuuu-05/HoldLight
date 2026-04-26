const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ClimbSession = require('../models/ClimbSession');

router.post('/', auth, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      userId: req.user.id,
    };

    const session = await ClimbSession.create(payload);
    return res.status(201).json({ success: true, session });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/active/me', auth, async (req, res) => {
  try {
    const session = await ClimbSession.findOne({ userId: req.user.id }).sort({ updatedAt: -1 });
    return res.json({ success: true, session });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/history/me', auth, async (req, res) => {
  try {
    const sessions = await ClimbSession.find({ userId: req.user.id }).sort({ updatedAt: -1 }).limit(30);
    return res.json({ success: true, sessions });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const session = await ClimbSession.findOne({ _id: req.params.id, userId: req.user.id });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    return res.json({ success: true, session });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const session = await ClimbSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...req.body },
      { new: true },
    );

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    return res.json({ success: true, session });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
