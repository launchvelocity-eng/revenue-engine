import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;

// 1. Resilient PostgreSQL Connection Pooling Configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                          // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,         // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000,    // Return an error if a connection takes longer than 2 seconds
});

// Log pooling errors to prevent unhandled node process crashes
pool.on('error', (err) => {
  console.error('An unexpected error occurred on the idle PostgreSQL pool client:', err);
});

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// 2. Crash-Proof Background Workers
async function runLeaseAuditWorker() {
  console.log('[LEASE WORKER] Initiating automated corporate lease expiration audit...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Safely wrapping the "status" reserved keyword in double quotes
    const queryText = `
      UPDATE tenant_vaults 
      SET "status" = 'expired' 
      WHERE expires_at < NOW() AND "status" = 'active';
    `;
    const res = await client.query(queryText);
    await client.query('COMMIT');
    console.log(`[LEASE WORKER] Audit complete. ${res.rowCount} vaults marked as expired.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[LEASE ERROR] Audit transaction failed and rolled back:', error.message);
  } finally {
    client.release(); // Return client to the pool immediately
  }
}

async function runDeclutterAssistantWorker() {
  console.log('[DECLUTTER ASSISTANT] Initiating automated enterprise storage and database audit...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Purges rows flagged as archived to keep performance optimized
    const queryText = `
      DELETE FROM tenant_vaults 
      WHERE "status" = 'archived' AND updated_at < NOW() - INTERVAL '30 days';
    `;
    const res = await client.query(queryText);
    await client.query('COMMIT');
    console.log(`[DECLUTTER ASSISTANT] Optimization complete. Purged ${res.rowCount} archived records.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DECLUTTER ERROR] Optimization transaction failed and rolled back:', error.message);
  } finally {
    client.release();
  }
}

// Start workers on isolated time loops (every 5 minutes for leases, every 10 minutes for declutter)
setInterval(runLeaseAuditWorker, 5 * 60 * 1000);
setInterval(runDeclutterAssistantWorker, 10 * 60 * 1000);

// Basic route endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', message: 'Launch Velocity Engine is operating at peak efficiency.' });
});

app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
  // Initial fire on startup to verify operational readiness
  runLeaseAuditWorker();
  runDeclutterAssistantWorker();
});
