const express = require('express');
const Room = require('../models/Room');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const auth = require('../middleware/auth');

const router = express.Router();

function buildPairKey(firstUserId, secondUserId) {
  return [String(firstUserId), String(secondUserId)].sort().join(':');
}

function toMember(user) {
  return {
    userId: user._id.toString(),
    userName: user.username,
    role: user.role,
    joinedAt: new Date(),
  };
}

function ensureReadState(room, userId, lastReadAt = new Date()) {
  const existing = room.readStates.find((item) => item.userId === userId);
  if (existing) {
    existing.lastReadAt = lastReadAt;
    return;
  }

  room.readStates.push({
    userId,
    lastReadAt,
  });
}

router.get('/', auth, async (_req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      rooms: rooms.map((room) => room.toJSON()),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    return res.json({
      success: true,
      room: room.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, gymName, region, description } = req.body;

    if (!title || !gymName || !region || !description) {
      return res.status(400).json({
        success: false,
        message: 'title, gymName, region, and description are required',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const room = await Room.create({
      title: title.trim(),
      gymName: gymName.trim(),
      region: region.trim(),
      description: description.trim(),
      createdById: user._id.toString(),
      createdByName: user.username,
      members: [toMember(user)],
      invitations: [],
      messages: [
        {
          userId: user._id.toString(),
          userName: user.username,
          body: 'Room created. Use this space to chat, ask for help, and invite friends to practice.',
          type: 'plan',
        },
      ],
      readStates: [
        {
          userId: user._id.toString(),
          lastReadAt: new Date(),
        },
      ],
    });

    return res.status(201).json({
      success: true,
      room: room.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/:roomId/join', auth, async (req, res) => {
  try {
    const [room, user] = await Promise.all([
      Room.findById(req.params.roomId),
      User.findById(req.user.id),
    ]);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userId = user._id.toString();
    const alreadyMember = room.members.some((member) => member.userId === userId);

    if (!alreadyMember) {
      room.members.push(toMember(user));
      room.messages.push({
        userId,
        userName: user.username,
        body: `${user.username} joined the room.`,
        type: 'plan',
      });
    }

    ensureReadState(room, userId);
    await room.save();

    return res.json({
      success: true,
      room: room.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/:roomId/invitations', auth, async (req, res) => {
  try {
    const { friendUserId } = req.body;
    const [room, currentUser, friendUser] = await Promise.all([
      Room.findById(req.params.roomId),
      User.findById(req.user.id),
      User.findById(friendUserId),
    ]);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if (!currentUser || !friendUser) {
      return res.status(404).json({
        success: false,
        message: 'Friend not found.',
      });
    }

    const currentUserId = currentUser._id.toString();
    const targetUserId = friendUser._id.toString();

    if (!room.members.some((member) => member.userId === currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Join the room first to invite friends.',
      });
    }

    const friendship = await Friendship.findOne({
      pairKey: buildPairKey(currentUserId, targetUserId),
    });

    if (!friendship) {
      return res.status(400).json({
        success: false,
        message: 'You can only invite confirmed friends.',
      });
    }

    const alreadyMember = room.members.some((member) => member.userId === targetUserId);
    const alreadyInvited = room.invitations.some(
      (invite) => invite.invitedUserId === targetUserId && invite.status === 'pending',
    );

    if (alreadyMember || alreadyInvited) {
      return res.json({
        success: true,
        room: room.toJSON(),
      });
    }

    room.invitations.push({
      roomId: room._id.toString(),
      roomName: room.title,
      invitedUserId: targetUserId,
      invitedUserName: friendUser.username,
      invitedById: currentUserId,
      invitedByName: currentUser.username,
      status: 'pending',
    });

    room.messages.push({
      userId: currentUserId,
      userName: currentUser.username,
      body: `${currentUser.username} invited ${friendUser.username} to join the room.`,
      type: 'plan',
    });

    await room.save();

    return res.json({
      success: true,
      room: room.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.patch('/:roomId/invitations/:invitationId', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const [room, user] = await Promise.all([
      Room.findById(req.params.roomId),
      User.findById(req.user.id),
    ]);

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be accepted or declined',
      });
    }

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userId = user._id.toString();
    const invitation = room.invitations.id(req.params.invitationId);

    if (!invitation || invitation.invitedUserId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    invitation.status = status;
    invitation.respondedAt = new Date();

    if (status === 'accepted' && !room.members.some((member) => member.userId === userId)) {
      room.members.push(toMember(user));
      room.messages.push({
        userId,
        userName: user.username,
        body: `${user.username} accepted the invitation and joined the room.`,
        type: 'plan',
      });
      ensureReadState(room, userId);
    }

    await room.save();

    return res.json({
      success: true,
      room: room.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.delete('/:roomId/invitations/:invitationId', auth, async (req, res) => {
  try {
    const [room, user] = await Promise.all([
      Room.findById(req.params.roomId),
      User.findById(req.user.id),
    ]);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userId = user._id.toString();
    const invitation = room.invitations.id(req.params.invitationId);

    if (!invitation || invitation.status !== 'pending') {
      return res.status(404).json({
        success: false,
        message: 'Pending invitation not found',
      });
    }

    const canWithdraw =
      invitation.invitedById === userId ||
      room.createdById === userId;

    if (!canWithdraw) {
      return res.status(403).json({
        success: false,
        message: 'Only the sender or room creator can withdraw this invitation.',
      });
    }

    const invitedUserName = invitation.invitedUserName;
    invitation.deleteOne();

    room.messages.push({
      userId,
      userName: user.username,
      body: `${user.username} withdrew the invitation for ${invitedUserName}.`,
      type: 'plan',
    });

    await room.save();

    return res.json({
      success: true,
      room: room.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/:roomId/messages', auth, async (req, res) => {
  try {
    const { body, type = 'chat' } = req.body;
    const [room, user] = await Promise.all([
      Room.findById(req.params.roomId),
      User.findById(req.user.id),
    ]);

    if (!body?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message body is required',
      });
    }

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userId = user._id.toString();
    if (!room.members.some((member) => member.userId === userId)) {
      return res.status(403).json({
        success: false,
        message: 'You need to join the room before sending messages.',
      });
    }

    room.messages.push({
      userId,
      userName: user.username,
      body: body.trim(),
      type,
    });
    ensureReadState(room, userId);
    await room.save();

    return res.status(201).json({
      success: true,
      room: room.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/:roomId/read', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if (!room.members.some((member) => member.userId === req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You need to join the room first.',
      });
    }

    ensureReadState(room, req.user.id, new Date());
    await room.save();

    return res.json({
      success: true,
      room: room.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
