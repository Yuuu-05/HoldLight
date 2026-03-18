const express = require('express');
const User = require('../models/User');
const Post = require('../models/Post');
const FriendRequest = require('../models/FriendRequest');
const Room = require('../models/Room');
const VolunteerPost = require('../models/VolunteerPost');
const auth = require('../middleware/auth');

const router = express.Router();

const tutorialModuleCount = 4;

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

function buildNotifications({ user, postsWithActivity, pendingRequests, myVolunteerPosts, upcomingSession, roomInvites }) {
  const tutorialCompletedCount = user.preferences?.tutorialProgress?.completedIds?.length ?? 0;
  const notifications = [];

  if (!isProfileComplete(user)) {
    notifications.push({
      id: 'profile-incomplete',
      type: 'profile_incomplete',
      to: '/onboarding',
      data: {},
    });
  }

  if (tutorialCompletedCount < tutorialModuleCount) {
    notifications.push({
      id: `tutorial-progress:${tutorialCompletedCount}:${tutorialModuleCount}`,
      type: 'tutorial_progress',
      to: '/tutorial',
      data: {
        completedCount: tutorialCompletedCount,
        totalCount: tutorialModuleCount,
      },
    });
  }

  if (postsWithActivity.length) {
    notifications.push({
      id: `social-activity:${postsWithActivity.length}`,
      type: 'social_activity',
      to: '/social/my',
      data: {
        count: postsWithActivity.length,
      },
    });
  }

  if (pendingRequests) {
    notifications.push({
      id: `friend-requests:${pendingRequests}`,
      type: 'friend_requests',
      to: '/social/friends',
      data: {
        count: pendingRequests,
      },
    });
  }

  if (myVolunteerPosts.length) {
    notifications.push({
      id: `volunteer-interest:${myVolunteerPosts.length}`,
      type: 'volunteer_interest',
      to: '/volunteer/contact-intent',
      data: {
        count: myVolunteerPosts.length,
      },
    });
  }

  if (upcomingSession) {
    notifications.push({
      id: `upcoming-session:${upcomingSession._id.toString()}:${new Date(upcomingSession.sessionTime).toISOString()}`,
      type: 'upcoming_session',
      to: '/volunteer/my-sessions',
      data: {
        title: upcomingSession.title,
        sessionTime: upcomingSession.sessionTime,
      },
    });
  }

  if (roomInvites.length) {
    notifications.push({
      id: `room-invitations:${roomInvites.length}`,
      type: 'room_invitations',
      to: '/social/rooms',
      data: {
        count: roomInvites.length,
      },
    });
  }

  return notifications;
}

async function loadNotificationContext(userId) {
  const [user, postsWithActivity, pendingRequests, myVolunteerPosts, upcomingSession, roomInvites] = await Promise.all([
    User.findById(userId),
    Post.find({
      authorId: userId,
      'comments.0': { $exists: true },
    }),
    FriendRequest.countDocuments({
      toUserId: userId,
      status: 'pending',
    }),
    VolunteerPost.find({
      authorId: userId,
      applicants: {
        $elemMatch: {
          status: { $in: ['interested', 'accepted'] },
        },
      },
    }),
    VolunteerPost.findOne({
      sessionTime: { $gte: new Date() },
      $or: [
        { authorId: userId },
        {
          applicants: {
            $elemMatch: {
              userId,
              status: { $in: ['accepted', 'completed'] },
            },
          },
        },
      ],
    }).sort({ sessionTime: 1 }),
    Room.find({
      invitations: {
        $elemMatch: {
          invitedUserId: userId,
          status: 'pending',
        },
      },
    }),
  ]);

  return {
    user,
    postsWithActivity,
    pendingRequests,
    myVolunteerPosts,
    upcomingSession,
    roomInvites,
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
