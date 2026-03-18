const express = require('express');
const FriendRequest = require('../models/FriendRequest');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

function buildPairKey(firstUserId, secondUserId) {
  return [String(firstUserId), String(secondUserId)].sort().join(':');
}

function toSocialUser(user) {
  return {
    userId: user._id.toString(),
    username: user.username,
    role: user.role,
    email: user.email,
    homeGym: user.profile?.homeGym,
    region: user.profile?.region,
    accessibilityNeeds: user.profile?.accessibilityNeeds,
  };
}

router.get('/network', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [users, requests, friendships] = await Promise.all([
      User.find().sort({ username: 1 }),
      FriendRequest.find({
        $or: [{ fromUserId: userId }, { toUserId: userId }],
      }).sort({ createdAt: -1 }),
      Friendship.find({
        $or: [{ userA: userId }, { userB: userId }],
      }),
    ]);

    const incoming = requests.filter((request) => request.toUserId === userId).map((item) => item.toJSON());
    const outgoing = requests.filter((request) => request.fromUserId === userId).map((item) => item.toJSON());
    const friendIds = friendships.map((item) => (item.userA === userId ? item.userB : item.userA));
    const friendIdSet = new Set(friendIds);

    const allUsers = users.map(toSocialUser);
    const friends = allUsers.filter((candidate) => friendIdSet.has(candidate.userId));

    const suggestions = allUsers.filter((candidate) => {
      if (candidate.userId === userId) return false;
      if (friendIdSet.has(candidate.userId)) return false;

      const pendingRequest = requests.some((request) =>
        request.status === 'pending' &&
        ((request.fromUserId === userId && request.toUserId === candidate.userId) ||
          (request.fromUserId === candidate.userId && request.toUserId === userId)),
      );

      return !pendingRequest;
    });

    return res.json({
      success: true,
      users: allUsers,
      friends,
      incoming,
      outgoing,
      suggestions,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/requests', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId is required',
      });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a friend request to yourself.',
      });
    }

    const [currentUser, targetUser, existingFriendship, existingPending] = await Promise.all([
      User.findById(currentUserId),
      User.findById(targetUserId),
      Friendship.findOne({ pairKey: buildPairKey(currentUserId, targetUserId) }),
      FriendRequest.findOne({
        status: 'pending',
        $or: [
          { fromUserId: currentUserId, toUserId: targetUserId },
          { fromUserId: targetUserId, toUserId: currentUserId },
        ],
      }),
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'The selected user could not be found.',
      });
    }

    if (existingFriendship) {
      return res.status(400).json({
        success: false,
        message: 'You are already friends with this user.',
      });
    }

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'A pending friend request already exists.',
      });
    }

    const request = await FriendRequest.create({
      fromUserId: currentUserId,
      fromUserName: currentUser.username,
      toUserId: targetUserId,
      toUserName: targetUser.username,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      request: request.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.patch('/requests/:requestId', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const currentUserId = req.user.id;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be accepted or rejected',
      });
    }

    const request = await FriendRequest.findById(req.params.requestId);

    if (!request || request.toUserId !== currentUserId) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found',
      });
    }

    request.status = status;
    request.respondedAt = new Date();
    await request.save();

    if (status === 'accepted') {
      await Friendship.findOneAndUpdate(
        { pairKey: buildPairKey(request.fromUserId, request.toUserId) },
        {
          $setOnInsert: {
            userA: [request.fromUserId, request.toUserId].sort()[0],
            userB: [request.fromUserId, request.toUserId].sort()[1],
            pairKey: buildPairKey(request.fromUserId, request.toUserId),
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
    }

    return res.json({
      success: true,
      request: request.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.delete('/requests/:requestId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const request = await FriendRequest.findById(req.params.requestId);

    if (!request || request.fromUserId !== currentUserId || request.status !== 'pending') {
      return res.status(404).json({
        success: false,
        message: 'Pending outgoing friend request not found',
      });
    }

    await request.deleteOne();

    return res.json({
      success: true,
      message: 'Friend request cancelled',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.delete('/:friendUserId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { friendUserId } = req.params;

    if (currentUserId === friendUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove yourself from your own friend list.',
      });
    }

    const friendship = await Friendship.findOne({
      pairKey: buildPairKey(currentUserId, friendUserId),
    });

    if (!friendship) {
      return res.status(404).json({
        success: false,
        message: 'Friendship not found',
      });
    }

    await friendship.deleteOne();
    await FriendRequest.deleteMany({
      $or: [
        { fromUserId: currentUserId, toUserId: friendUserId },
        { fromUserId: friendUserId, toUserId: currentUserId },
      ],
    });

    return res.json({
      success: true,
      message: 'Friend removed',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
