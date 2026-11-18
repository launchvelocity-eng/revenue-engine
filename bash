import express from 'express';
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

// Allow requests from your GitHub Pages frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://launchvelocity-eng.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Raw body required for Stripe webhook signature verification
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

// 1. Health & PostgreSQL Check
app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS now');
    res.json({
      status: 'ONLINE',
      engine: 'Launch Velocity Core',
      dbTime: rows[0].now
    });
  } catch (err) {
    res.status(500).json({ status: 'DB_ERROR', error: err.message });
  }
});

// 2. Stripe Webhook Listener ($199 / $499 / $999 Tier Provisioning)
app.post('/webhook/stripe', async (req, res) => {
  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email;
    const amountTotal = session.amount_total || 0;

    if (!email) {
      return res.status(400).json({ error: 'Missing customer email in session' });
    }

    let tier = 'starter';
    if (amountTotal >= 99900) tier = 'enterprise';
    else if (amountTotal >= 49900) tier = 'growth';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tenantRes = await client.query(
        `INSERT INTO tenants (email, stripe_customer_id, tier, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (email) DO UPDATE
         SET stripe_customer_id = EXCLUDED.stripe_customer_id,
             tier = EXCLUDED.tier,
             status = 'active'
         RETURNING id`,
        [email, session.customer, tier]
      );

      await client.query(
        `INSERT INTO billing_events (tenant_id, stripe_event_id, event_type, amount_paid)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (stripe_event_id) DO NOTHING`,
        [tenantRes.rows[0].id, event.id, event.type, amountTotal]
      );

      await client.query('COMMIT');
      console.log(`[STRIPE] Provisioned '${tier}' for ${email}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[STRIPE_DB_ERROR]', err.message);
      return res.status(500).json({ error: 'Database provisioning failed' });
    } finally {
      client.release();
    }
  }

  res.json({ received: true });
});

// 3. Zero-Trust Vault Asset Registration
app.post('/api/vault/upload', async (req, res) => {
  const { email, fileName, fileSize, fileBufferHex } = req.body;

  if (!email || !fileName || !fileBufferHex) {
    return res.status(400).json({ error: 'Missing required payload fields' });
  }

  try {
    const tenantRes = await pool.query(
      'SELECT id, status FROM tenants WHERE email = $1',
      [email]
    );

    if (tenantRes.rows.length === 0 || tenantRes.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Inactive or unauthorized tenant' });
    }

    const tenantId = tenantRes.rows[0].id;
    const hash = crypto.createHash('sha256').update(fileBufferHex).digest('hex');
    const storagePath = `/secure-vault/${tenantId}/${Date.now()}_${fileName}.enc`;

    await pool.query(
      `INSERT INTO vault_assets (tenant_id, file_name, file_size_bytes, storage_path, sha256_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, fileName, fileSize || 0, storagePath, hash]
    );

    res.json({ success: true, sha256: hash, status: 'LOCKED' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Launch Velocity engine listening on port ${PORT}`);
});
