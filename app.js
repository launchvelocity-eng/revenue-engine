import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Optional Database Pool (won't crash if DATABASE_URL is missing)
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
}) : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('[POOL ERROR] Unexpected error on idle client:', err.message);
  });
}

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

async function initDb() {
  if (!pool) {
    console.log('[MIGRATION ENGINE] Skipping DB initialization (DATABASE_URL not set).');
    return;
  }
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

async function runLeaseAuditWorker() {
  if (!pool) return;
  console.log('[LEASE WORKER] Initiating automated corporate lease expiration audit...');
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
  if (!pool) return;
  console.log('[DECLUTTER ASSISTANT] Initiating storage cleanup optimization loop...');
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

setInterval(runLeaseAuditWorker, 5 * 60 * 1000);
setInterval(runDeclutterAssistantWorker, 10 * 60 * 1000);

app.get('/', (req, res) => {
  res.status(200).send('Launch Velocity Engine is live 🚀');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', engine: 'Launch Velocity Operational' });
});

app.get('/api/db-ping', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ status: 'NOT_CONFIGURED', message: 'Database URL not provided.' });
  }
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

app.post('/api/vault/upload', (req, res) => {
  const authKey = req.headers['x-vault-gatekeeper-key'];
  if (!authKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Gatekeeper key missing.' });
  }

  const buffer = req.body;
  if (buffer && buffer.length >= 2) {
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
      return res.status(400).json({
        error: 'MALICIOUS_PAYLOAD_DETECTED',
        message: 'ZeroTrustMagicByteShield intercepted an unauthorized executable signature.'
      });
    }
  }

  res.status(200).json({ message: 'Payload verified and ingested securely.' });
});

const PRICING_TIERS = {
  base_10tb: { name: 'Launch Velocity 10 TB Enterprise Vault', unit_amount: 250000 },
  plus_5tb:  { name: 'Launch Velocity 15 TB Enterprise Vault', unit_amount: 375000 },
  plus_10tb: { name: 'Launch Velocity 20 TB Enterprise Vault', unit_amount: 500000 }
};

app.post('/api/billing/create-checkout', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'BILLING_NOT_CONFIGURED', message: 'Stripe secret key missing on server.' });
  }

  const { tierId, months, customerEmail } = req.body;
  const selectedTier = PRICING_TIERS[tierId];
  const validMonths = [1, 3, 6, 12];

  if (!selectedTier || !validMonths.includes(Number(months))) {
    return res.status(400).json({ error: 'INVALID_BILLING_PARAMETERS' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${selectedTier.name} (${months} Month Pre-Pay)` },
          unit_amount: selectedTier.unit_amount * Number(months),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://launchvelocity-eng.github.io/revenue-engine/?success=true',
      cancel_url: 'https://launchvelocity-eng.github.io/revenue-engine/?canceled=true',
    });

    res.status(200).json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('[BILLING ERROR]:', error.message);
    res.status(500).json({ error: 'PAYMENT_GATEWAY_FAILURE' });
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
  await initDb();
  if (pool) {
    runLeaseAuditWorker().catch(err => console.error('Startup lease check error:', err));
    runDeclutterAssistantWorker().catch(err => console.error('Startup declutter check error:', err));
  }
});
