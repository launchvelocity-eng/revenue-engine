import express from 'express';
import pkg from 'pg';
import Redis from 'ioredis';

const { Pool } = pkg;

// 1. Instantiate Express and define port
const app = express();
const PORT = process.env.PORT || 10000;

// 2. Initialize Database Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 3. Initialize Managed Redis Client
const redis = new Redis(process.env.REDIS_URL);

// 4. Automated Schema Provisioning
async function initDatabaseSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_leases (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        partition_name VARCHAR(255) NOT NULL,
        lease_status VARCHAR(50) DEFAULT 'GRACE_PERIOD',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        finalized_at TIMESTAMP WITH TIME ZONE
      );
    `);
    await client.query('COMMIT;');
    console.log('[DB ENGINE] Schema initialized successfully.');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[DB ENGINE ERROR] Schema initialization failed:', err);
  } finally {
    client.release();
  }
}

// Run schema setup on boot
await initDatabaseSchema();

// 5. Sliding Window IP Rate Limiter Middleware
async function redisRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const key = `rate:${ip}`;
  
  const LIMIT = 60;
  const WINDOW_MS = 60000;
  const now = Date.now();
  const clearBefore = now - WINDOW_MS;

  try {
    const result = await redis.multi()
      .zremrangebyscore(key, 0, clearBefore)
      .zadd(key, now, now)
      .zcard(key)
      .pexpire(key, WINDOW_MS)
      .exec();

    const requestCount = result[2][1];

    if (requestCount > LIMIT) {
      return res.status(429).json({
        error: 'Too Many Requests',
        details: 'Rate limit exceeded. Please back off for 60 seconds.'
      });
    }

    res.setHeader('X-RateLimit-Limit', LIMIT);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, LIMIT - requestCount));
    
    next();
  } catch (err) {
    console.error('[SECURITY WARNING] Redis rate-limiter failure, falling back open:', err.message);
    next();
  }
}

// 6. Middleware & Routes
app.use(express.json());
app.use('/api/vault/', redisRateLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'revenue-engine' });
});

// 7. Bind and start server instance
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
