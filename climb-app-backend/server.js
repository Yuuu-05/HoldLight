require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const friendRoutes = require('./routes/friends');
const roomRoutes = require('./routes/rooms');
const volunteerRoutes = require('./routes/volunteers');
const notificationRoutes = require('./routes/notifications');
const climbScanRoutes = require('./routes/climbScans');
const climbSessionRoutes = require('./routes/climbSessions');
const guidanceLogRoutes = require('./routes/guidanceLogs');
const visionRoutes = require('./routes/vision');

const app = express();

app.use(cors());
app.use(express.json({ limit: process.env.BODY_LIMIT || '12mb' }));

mongoose.connect(process.env.MONGO_URI, { tlsAllowInvalidCertificates: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/climb-scans', climbScanRoutes);
app.use('/api/climb-sessions', climbSessionRoutes);
app.use('/api/guidance-logs', guidanceLogRoutes);
app.use('/api/vision', visionRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.get('/', (_req, res) => {
  res.send('Climb App Backend is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
