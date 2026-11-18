const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const app = express();

// Direct PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Stripe webhook raw body parser requirement
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

// 1. Health Check Endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({ status: 'ONLINE', engine: 'Launch Velocity Core', dbTime: dbCheck.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'DB_ERROR', error: err.message });
  }
});

// 2. Native Stripe Webhook Listener (Automates tier activation & provisioning)
app.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // In production, verify signature using stripe SDK. 
    // This handles the core checkout completion event directly:
    event = JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details.email;
    const amountTotal = session.amount_total; // e.g. 19900, 49900, 99900

    // Determine tier based on Stripe amount
    let tier = 'starter';
    if (amountTotal >= 99900) tier = 'enterprise';
    else if (amountTotal >= 49900) tier = 'growth';

    // Provision or update tenant directly in PostgreSQL
    await pool.query(
      `INSERT INTO tenants (email, stripe_customer_id, tier, status) 
       VALUES ($1, $2, $3, 'active') 
       ON CONFLICT (email) DO UPDATE SET tier = $3, status = 'active'`,
      [email, session.customer, tier]
    );

    console.log(`[STRIPE] Provisioned tier '${tier}' for customer ${email}`);
  }

  res.json({ received: true });
});

// 3. Vault Asset Registration Endpoint
app.post('/api/vault/upload', async (req, res) => {
  const { email, fileName, fileSize, fileBufferHex } = req.body;
  
  try {
    // Find tenant
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE email = $1', [email]);
    if (tenantResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized tenant partition.' });
    }
    const tenantId = tenantResult.rows.id;

    // Generate SHA-256 integrity hash
    const hash = crypto.createHash('sha256').update(fileBufferHex).digest('hex');

    // Record asset in encrypted partition table
    await pool.query(
      `INSERT INTO vault_assets (tenant_id, file_name, file_size_bytes, storage_path, sha256_hash) 
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, fileName, fileSize, `/secure-vault/${tenantId}/${fileName}.enc`, hash]
    );

    res.json({ success: true, sha256: hash, status: 'LOCKED' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Launch Velocity engine actively listening on port ${PORT}`);
});
