function createRateLimiter({
  windowMs,
  maxRequests,
  keyPrefix = 'rate',
  keyFn,
  message = 'Too many requests. Please slow down and try again.',
}) {
  const buckets = new Map();

  function prune(now) {
    for (const [key, entry] of buckets.entries()) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    if (buckets.size > 2000) {
      prune(now);
    }

    const derivedKey = keyFn ? keyFn(req) : req.ip;
    const key = `${keyPrefix}:${derivedKey || 'anonymous'}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    current.count += 1;
    if (current.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };
}

function buildRateLimiterFromEnv({
  envPrefix,
  defaultWindowMs,
  defaultMaxRequests,
  keyPrefix,
  keyFn,
  message,
}) {
  const windowMs = Number.parseInt(process.env[`${envPrefix}_WINDOW_MS`] || String(defaultWindowMs), 10);
  const maxRequests = Number.parseInt(process.env[`${envPrefix}_MAX`] || String(defaultMaxRequests), 10);

  return createRateLimiter({
    windowMs: Number.isFinite(windowMs) ? windowMs : defaultWindowMs,
    maxRequests: Number.isFinite(maxRequests) ? maxRequests : defaultMaxRequests,
    keyPrefix,
    keyFn,
    message,
  });
}

module.exports = {
  createRateLimiter,
  buildRateLimiterFromEnv,
};
