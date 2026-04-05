const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const defaultAccessibilityPreferences = {
  speechEnabled: true,
  feedbackEnabled: true,
  highContrast: false,
  largeText: false,
  simplifiedMode: false,
  voiceCommandsEnabled: false,
  speechRate: 1,
  speechVolume: 1,
  fontScale: 1,
};

const defaultOnboardingPreferences = {
  completed: false,
  accessibilitySetupCompleted: true,
  guideCompleted: false,
  completedAt: null,
};

function buildUserPreferences(user) {
  const preferences = user.preferences?.toObject?.() ?? user.preferences ?? {};
  const notifications = preferences.notifications ?? {};
  const onboarding = preferences.onboarding ?? {};

  return {
    language: preferences.language || 'en',
    accessibility: {
      ...defaultAccessibilityPreferences,
      ...(preferences.accessibility ?? {}),
    },
    notifications: {
      readIds: notifications.readIds ?? [],
      updatedAt: notifications.updatedAt ?? null,
    },
    onboarding: {
      ...defaultOnboardingPreferences,
      ...(onboarding ?? {}),
      completedAt: onboarding.completedAt ?? null,
    },
  };
}

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.put('/me', auth, async (req, res) => {
  try {
    const { username, profile } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (username) {
      user.username = username.trim();
    }

    if (profile && typeof profile === 'object') {
      const currentProfile = user.profile?.toObject?.() ?? user.profile ?? {};
      user.profile = {
        ...currentProfile,
        ...profile,
      };
    }

    user.updatedAt = new Date();
    await user.save();

    return res.json({
      success: true,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get('/me/role', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get('/me/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      preferences: buildUserPreferences(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.patch('/me/preferences', auth, async (req, res) => {
  try {
    const { language, accessibility, notifications, onboarding } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const current = buildUserPreferences(user);
    const nextPreferences = {
      language: language || current.language,
      accessibility:
        accessibility && typeof accessibility === 'object'
          ? {
              ...current.accessibility,
              ...accessibility,
            }
          : current.accessibility,
      notifications:
        notifications && Array.isArray(notifications.readIds)
          ? {
              readIds: [...new Set(notifications.readIds.filter(Boolean))],
              updatedAt: new Date(),
            }
          : current.notifications,
      onboarding:
        onboarding && typeof onboarding === 'object'
          ? {
              ...current.onboarding,
              ...onboarding,
              completedAt:
                (onboarding.completed ?? current.onboarding.completed)
                  ? onboarding.completedAt ?? current.onboarding.completedAt ?? new Date()
                  : null,
            }
          : current.onboarding,
    };

    user.preferences = nextPreferences;
    user.updatedAt = new Date();
    await user.save();

    return res.json({
      success: true,
      preferences: buildUserPreferences(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
