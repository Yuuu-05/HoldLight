const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

function isProfileComplete(user) {
  const profile = user.profile ?? {};
  return Boolean(
    profile.gender &&
    profile.height &&
    profile.weight &&
    profile.birthday &&
    profile.climbingExperience,
  );
}

function buildNotifications({ user }) {
  const notifications = [];

  if (!isProfileComplete(user)) {
    notifications.push({
      id: 'profile-incomplete',
      type: 'profile_incomplete',
      to: '/profile/edit',
      data: {},
    });
  }

  return notifications;
}

async function loadNotificationContext(userId) {
  return {
    user: await User.findById(userId),
  };
}

router.get('/', auth, async (req, res) => {
  try {
    const context = await loadNotificationContext(req.user.id);

    if (!context.user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const notifications = buildNotifications(context);
    const readIds = context.user.preferences?.notifications?.readIds ?? [];

    return res.json({
      success: true,
      notifications,
      readIds,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/read', auth, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        message: 'notificationIds must be an array',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const currentReadIds = user.preferences?.notifications?.readIds ?? [];
    const nextReadIds = [...new Set([...currentReadIds, ...notificationIds.filter(Boolean)])];

    user.preferences = {
      ...(user.preferences?.toObject?.() ?? user.preferences ?? {}),
      notifications: {
        readIds: nextReadIds,
        updatedAt: new Date(),
      },
    };
    user.updatedAt = new Date();
    await user.save();

    return res.json({
      success: true,
      readIds: nextReadIds,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
