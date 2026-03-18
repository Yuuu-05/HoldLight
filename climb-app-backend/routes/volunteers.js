const express = require('express');
const VolunteerPost = require('../models/VolunteerPost');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const posts = await VolunteerPost.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      posts: posts.map((post) => post.toJSON()),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get('/contact-intents', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const posts = await VolunteerPost.find({
      $or: [
        { authorId: userId },
        { applicants: { $elemMatch: { userId } } },
      ],
    }).sort({ sessionTime: 1 });

    const myRequests = posts
      .filter((post) => post.authorId === userId)
      .map((post) => post.toJSON());

    const myApplications = posts
      .map((post) => {
        const serialized = post.toJSON();
        return {
          item: serialized,
          application: serialized.applicants.find((application) => application.userId === userId) || null,
        };
      })
      .filter((record) => record.application);

    return res.json({
      success: true,
      myRequests,
      myApplications,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get('/my-sessions', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const posts = await VolunteerPost.find({
      $or: [
        { authorId: userId },
        { applicants: { $elemMatch: { userId } } },
      ],
    }).sort({ sessionTime: 1 });

    return res.json({
      success: true,
      sessions: posts.map((post) => post.toJSON()),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get('/:postId', async (req, res) => {
  try {
    const post = await VolunteerPost.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer request not found',
      });
    }

    return res.json({
      success: true,
      post: post.toJSON(),
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
    const { title, location, sessionTime, difficulty, notes } = req.body;

    if (!title || !location || !sessionTime || !difficulty || !notes) {
      return res.status(400).json({
        success: false,
        message: 'title, location, sessionTime, difficulty, and notes are required',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const post = await VolunteerPost.create({
      title: title.trim(),
      location: location.trim(),
      sessionTime,
      difficulty: difficulty.trim(),
      notes: notes.trim(),
      authorId: user._id.toString(),
      authorName: user.username,
      applicants: [],
    });

    await User.findByIdAndUpdate(user._id, {
      $addToSet: { volunteerSessions: post._id },
      $set: { updatedAt: new Date() },
    });

    return res.status(201).json({
      success: true,
      post: post.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/:postId/applications', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const [post, user] = await Promise.all([
      VolunteerPost.findById(req.params.postId),
      User.findById(req.user.id),
    ]);

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Application message is required',
      });
    }

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer request not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userId = user._id.toString();

    if (post.authorId === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot apply to your own volunteer request.',
      });
    }

    const existingApplication = post.applicants.find((application) => application.userId === userId);
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You already expressed interest in this request.',
      });
    }

    post.applicants.push({
      userId,
      userName: user.username,
      message: message.trim(),
      status: 'interested',
      updatedAt: new Date(),
    });
    await post.save();

    await User.findByIdAndUpdate(user._id, {
      $addToSet: { volunteerSessions: post._id },
      $set: { updatedAt: new Date() },
    });

    return res.status(201).json({
      success: true,
      post: post.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.patch('/:postId/applications/:applicationId', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const [post, user] = await Promise.all([
      VolunteerPost.findById(req.params.postId),
      User.findById(req.user.id),
    ]);

    if (!['accepted', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be accepted or completed',
      });
    }

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer request not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userId = user._id.toString();
    const application = post.applicants.id(req.params.applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer application not found',
      });
    }

    const isAuthor = post.authorId === userId;
    const isApplicant = application.userId === userId;

    if (status === 'accepted' && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Only the request author can accept a volunteer application.',
      });
    }

    if (status === 'completed' && !isAuthor && !isApplicant) {
      return res.status(403).json({
        success: false,
        message: 'Only the request author or selected volunteer can complete this session.',
      });
    }

    if (status === 'accepted' && application.status !== 'interested') {
      return res.status(400).json({
        success: false,
        message: 'Only interested applications can be accepted.',
      });
    }

    if (status === 'completed' && application.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Only accepted applications can be completed.',
      });
    }

    application.status = status;
    application.updatedAt = new Date();
    await post.save();

    return res.json({
      success: true,
      post: post.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.delete('/:postId/applications/:applicationId', auth, async (req, res) => {
  try {
    const [post, user] = await Promise.all([
      VolunteerPost.findById(req.params.postId),
      User.findById(req.user.id),
    ]);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer request not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userId = user._id.toString();
    const application = post.applicants.id(req.params.applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer application not found',
      });
    }

    const isAuthor = post.authorId === userId;
    const isApplicant = application.userId === userId;

    if (!isAuthor && !isApplicant) {
      return res.status(403).json({
        success: false,
        message: 'Only the request author or the volunteer can cancel this application.',
      });
    }

    if (!['interested', 'accepted'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only active volunteer applications can be cancelled.',
      });
    }

    application.status = 'cancelled';
    application.updatedAt = new Date();
    await post.save();

    return res.json({
      success: true,
      post: post.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
