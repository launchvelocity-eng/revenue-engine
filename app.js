import Redis from 'ioredis';

// Connect to a managed enterprise Redis cluster instance
const redis = new Redis(process.env.REDIS_URL);

/**
 * Sliding Window IP Rate Limiter Middleware via Redis
 * Restricts clients to a set threshold per minute with millisecond accuracy.
 */
export async function redisRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const key = `rate:${ip}`;
  
  const LIMIT = 60; // Max allowed requests
  const WINDOW_MS = 60000; // Time window: 1 minute (60,000 ms)
  
  const now = Date.now();
  const clearBefore = now - WINDOW_MS;

  try {
    // Execute atomically via Redis Pipeline transaction
    const result = await redis.multi()
      .zremrangebyscore(key, 0, clearBefore) // 1. Evict logs older than 1 minute
      .zadd(key, now, now)                  // 2. Add current timestamp record
      .zcard(key)                           // 3. Count total active logs remaining
      .pexpire(key, WINDOW_MS)              // 4. Set automatic sliding key expiration
      .exec();

    // The third operation response index contains the exact card element count
    const requestCount = result[2][1];

    if (requestCount > LIMIT) {
      return res.status(429).json({
        error: 'Too Many Requests',
        details: 'Rate limit exceeded. Please back off for 60 seconds.'
      });
    }

    // Append security track headers to responses
    res.setHeader('X-RateLimit-Limit', LIMIT);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, LIMIT - requestCount));
    
    next();
  } catch (err) {
    console.error('[SECURITY WARNING] Redis rate-limiter failure, falling back open:', err.message);
    next(); // Fallback open to preserve platform availability if caching infrastructure slips
  }
}
