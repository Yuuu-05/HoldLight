const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
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

router.get('/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
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
    const { title, body, tags = [] } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title and body are required',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const post = new Post({
      title: title.trim(),
      body: body.trim(),
      tags: Array.isArray(tags)
        ? tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [],
      authorId: user._id.toString(),
      authorName: user.username,
      authorRole: user.role,
      likedBy: [],
      comments: [],
    });

    await post.save();
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { posts: post._id },
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

router.post('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const userId = req.user.id;
    const hasLiked = post.likedBy.includes(userId);
    post.likedBy = hasLiked
      ? post.likedBy.filter((id) => id !== userId)
      : [...post.likedBy, userId];
    await post.save();

    await User.findByIdAndUpdate(userId, hasLiked
      ? {
          $pull: { likedPosts: post._id },
          $set: { updatedAt: new Date() },
        }
      : {
          $addToSet: { likedPosts: post._id },
          $set: { updatedAt: new Date() },
        });

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

router.post('/:postId/comments', auth, async (req, res) => {
  try {
    const { body } = req.body;

    if (!body?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment body is required',
      });
    }

    const [post, user] = await Promise.all([
      Post.findById(req.params.postId),
      User.findById(req.user.id),
    ]);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    post.comments.push({
      authorId: user._id.toString(),
      authorName: user.username,
      body: body.trim(),
    });
    await post.save();

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

module.exports = router;
