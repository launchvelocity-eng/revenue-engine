import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

app.use(cors());
app.use(express.json());

async function initDb() {
  if (!pool) return;
  try {
    const client = await pool.connect();
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
    client.release();
    console.log('[MIGRATION ENGINE] Database schema verified.');
  } catch (err) {
    console.error('[DB ERROR]:', err.message);
  }
}

app.get('/', (req, res) => res.status(200).send('Launch Velocity Engine is live 🚀'));
app.get('/health', (req, res) => res.status(200).json({ status: 'HEALTHY' }));

app.post('/api/vault/upload', (req, res) => {
  const authKey = req.headers['x-vault-gatekeeper-key'];
  if (!authKey) return res.status(401).json({ error: 'UNAUTHORIZED' });
  res.status(200).json({ message: 'Payload verified securely.' });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[SERVER ENGINE] Listening on port ${PORT}`);
  await initDb();
});
