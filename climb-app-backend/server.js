require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const climbScanRoutes = require('./routes/climbScans');
const climbSessionRoutes = require('./routes/climbSessions');
const guidanceLogRoutes = require('./routes/guidanceLogs');
const visionRoutes = require('./routes/vision');
const { getVisionProvider, warmVisionRuntime } = require('./services/visionProvider');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI?.trim();
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const TRUST_PROXY = String(process.env.TRUST_PROXY || '')
  .trim()
  .toLowerCase();
const IS_PRODUCTION = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

function buildCorsOptions() {
  if (CORS_ORIGINS.length === 0) {
    if (IS_PRODUCTION) {
      return {
        origin: false,
        credentials: true,
      };
    }

    return {
      origin: true,
      credentials: true,
    };
  }

  return {
    origin(origin, callback) {
      if (!origin || CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin is not allowed.'));
    },
    credentials: true,
  };
}

function isEnabled(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

if (TRUST_PROXY) {
  app.set('trust proxy', TRUST_PROXY === 'true' ? 1 : TRUST_PROXY);
}

if (IS_PRODUCTION && CORS_ORIGINS.length === 0) {
  console.warn('CORS_ORIGINS is empty in production; cross-origin browser requests will be denied.');
}

app.disable('x-powered-by');
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: process.env.BODY_LIMIT || '12mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/climb-scans', climbScanRoutes);
app.use('/api/climb-sessions', climbSessionRoutes);
app.use('/api/guidance-logs', guidanceLogRoutes);
app.use('/api/vision', visionRoutes);

app.get('/api/health', async (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  try {
    const vision = await getVisionProvider().health();
    const healthy = databaseConnected && vision.ready;

    res.status(healthy ? 200 : 503).json({
      success: healthy,
      status: healthy ? 'ok' : 'degraded',
      database: {
        state: databaseConnected ? 'connected' : 'disconnected',
        name: mongoose.connection.name || '',
      },
      vision,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'degraded',
      database: {
        state: databaseConnected ? 'connected' : 'disconnected',
        name: mongoose.connection.name || '',
      },
      vision: {
        ready: false,
        lastError: error.message,
      },
    });
  }
});

app.get('/', (_req, res) => {
  res.send('Climb App Backend is running!');
});

async function warmProductionServices() {
  if (isEnabled(process.env.VISION_WARM_ON_START, true)) {
    warmVisionRuntime().then(
      () => console.log('Vision runtime warmed successfully.'),
      (error) => console.warn('Vision runtime warm-up failed:', error.message),
    );
  }
}

async function startServer() {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is required. The backend only runs against a real MongoDB database.');
  }

  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    void warmProductionServices();
  });
}

startServer().catch((error) => {
  console.error('Failed to start backend:', error.message);
  process.exit(1);
});
