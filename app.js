import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;

// 1. Configure the Pool Instance First
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[POOL ERROR] Unexpected error on idle client:', err.message);
});

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// 2. Self-Healing Schema Initialization
async function initDb() {
  console.log('[MIGRATION ENGINE] Checking database tables...');
  let client;
  try {
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_vaults (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        "status" VARCHAR(50) DEFAULT 'active',
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 year',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('[MIGRATION ENGINE] Database schema verified: All systems green.');
  } catch (error) {
    console.error('[DB ERROR] Failed to initialize database schema:', error.message);
  } finally {
    if (client) client.release();
  }
}

// 3. Resilient Background Workers
async function runLeaseAuditWorker() {
  console.log('[LEASE WORKER] Initiating automated corporate lease expiration audit...');
  if (!process.env.DATABASE_URL) return;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const res = await client.query(`
      UPDATE tenant_vaults 
      SET "status" = 'expired' 
      WHERE expires_at < NOW() AND "status" = 'active';
    `);
    await client.query('COMMIT');
    console.log(`[LEASE WORKER] Audit complete. ${res.rowCount} records processed.`);
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('[LEASE ERROR] Audit failed:', error.message);
  } finally {
    if (client) client.release();
  }
}

async function runDeclutterAssistantWorker() {
  console.log('[DECLUTTER ASSISTANT] Initiating storage cleanup optimization loop...');
  if (!process.env.DATABASE_URL) return;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const res = await client.query(`
      DELETE FROM tenant_vaults 
      WHERE "status" = 'archived' AND updated_at < NOW() - INTERVAL '30 days';
    `);
    await client.query('COMMIT');
    console.log(`[DECLUTTER ASSISTANT] Optimization complete. Purged ${res.rowCount} records.`);
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('[DECLUTTER ERROR] Optimization failed:', error.message);
  } finally {
    if (client) client.release();
  }
}

// Intervals
setInterval(runLeaseAuditWorker, 5 * 60 * 1000);
setInterval(runDeclutterAssistantWorker, 10 * 60 * 1000);

// Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', engine: 'Launch Velocity Operational' });
});

app.get('/api/db-ping', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const dbResponse = await client.query('SELECT NOW() as current_server_time, count(*) from tenant_vaults;');
    res.status(200).json({
      status: 'CONNECTED',
      database_time: dbResponse.rows[0].current_server_time,
      active_vaults: parseInt(dbResponse.rows[0].count, 10),
      pool: { total: pool.totalCount, idle: pool.idleCount }
    });
  } catch (error) {
    res.status(500).json({ status: 'CONNECTION_FAILED', error: error.message });
  } finally {
    if (client) client.release();
  }
});

app.listen(PORT, async () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
  // Run schema migration first, then fire workers safely
  await initDb();
  runLeaseAuditWorker().catch(err => console.error('Startup lease check error:', err));
  runDeclutterAssistantWorker().catch(err => console.error('Startup declutter check error:', err));
});
