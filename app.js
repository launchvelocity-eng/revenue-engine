import { redisRateLimiter } from './src/middleware/rateLimiter.js';

// Apply the Redis sliding window rate limiter to all incoming vault routes
app.use('/api/vault/', redisRateLimiter);
