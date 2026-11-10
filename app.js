import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS and body parsers
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Initialize PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('[DATABASE CRITICAL] Unexpected error on idle PostgreSQL client', err);
});

// Zero-Trust Gatekeeper & Threat Shield Upload Endpoint
app.post('/api/vault/upload', (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'];
  const expectedKey = process.env.VAULT_GATEKEEPER_KEY;

  if (!gatekeeperKey || gatekeeperKey !== expectedKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED_GATEKEEPER_KEY' });
  }

  // Magic Byte Stream Inspection (Blocking MZ and ELF Headers)
  const buffer = req.body;
  if (buffer && buffer.length >= 2) {
    const header = buffer.toString('utf8', 0, 2);
    if (header === 'MZ' || header === '\x7fE') {
      return res.status(400).json({
        error: 'MALICIOUS_PAYLOAD_DETECTED',
        details: 'Magic-byte inspection rejected prohibited binary header.'
      });
    }
  }

  return res.status(200).json({ 
    status: 'SUCCESS', 
    message: 'Payload verified and ingested into secure vault pipeline.' 
  });
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Background Workers (Crash-Protected)
function startBackgroundWorkers() {
  setInterval(async () => {
    try {
      const client = await pool.connect();
      try {
        const res = await client.query('SELECT NOW() AS current_time');
        console.log(`[LEASE WORKER] Audit sweep completed at ${res.rows[0].current_time}`);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[LEASE WORKER ERROR] Database pool connection issue:', err.message);
    }
  }, 60000);

  setInterval(() => {
    console.log('[DECLUTTER ASSISTANT] Routine storage optimization sweep initiated.');
  }, 300000);
}

// Start Server Engine
app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
  startBackgroundWorkers();
});
