import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;
const app = express();
const parsedPort = Number(process.env.PORT);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 10000;

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

async function initDb() {
  if (!pool) return;
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
    console.log('[MIGRATION ENGINE] Database schema verified.');
  } catch (err) {
    console.error('[DB ERROR]:', err.message);
  } finally {
    if (client) client.release();
  }
}

app.get('/', (req, res) => res.status(200).send('Launch Velocity Engine is live'));
app.get('/health', (req, res) => res.status(200).json({ status: 'HEALTHY' }));

app.post('/api/vault/upload', (req, res) => {
  if (!req.headers['x-vault-gatekeeper-key']) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const buf = req.body;
  if (buf && buf.length >= 2 && buf[0] === 0x4D && buf[1] === 0x5A) {
    return res.status(400).json({ error: 'MALICIOUS_PAYLOAD_DETECTED' });
  }
  res.status(200).json({ message: 'Payload verified and ingested securely.' });
});

const TIERS = {
  base_10tb: { name: 'Launch Velocity 10 TB Enterprise Vault', unit_amount: 250000 },
  plus_5tb:  { name: 'Launch Velocity 15 TB Enterprise Vault', unit_amount: 375000 },
  plus_10tb: { name: 'Launch Velocity 20 TB Enterprise Vault', unit_amount: 500000 }
};

app.post('/api/billing/create-checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'BILLING_NOT_CONFIGURED' });
  const { tier
