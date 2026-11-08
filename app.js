import express from 'express';
import pkg from 'pg';
import express from 'express';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import pkg from 'pg';
const { Pool } = pkg;

const app = express(); 
const PORT = process.env.PORT || 10000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =========================================================================
// PASTE THE RATE LIMITER FUNCTION DIRECTLY INLINE HERE
// =========================================================================
async function redisRateLimiter(req, res, next) {
  // If you don't have Redis provisioned yet, keep it as a transparent pass-through:
  next();
}


const { Pool } = pkg;

// 1. Instantiate Express and define port
const app = express();
const PORT = process.env.PORT || 10000;

// 2. Initialize Database Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 3. Automated Schema Provisioning
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

// 4. Middleware & Routes
app.use(express.json());
app.use('/api/vault/', redisRateLimiter);

// 5. Bind and start server instance
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
