cat << 'EOF' > app.js
import express from 'express';
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({ status: 'ONLINE', engine: 'Launch Velocity Core', dbTime: dbCheck.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'DB_ERROR', error: err.message });
  }
});

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
    const amountTotal = session.amount_total;

    let tier = 'starter';
    if (amountTotal >= 99900) tier = 'enterprise';
    else if (amountTotal >= 49900) tier = 'growth';

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

app.post('/api/vault/upload', async (req, res) => {
  const { email, fileName, fileSize, fileBufferHex } = req.body;
  try {
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE email = $1', [email]);
    if (tenantResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized tenant partition.' });
    }
    const tenantId = tenantResult.rows[0].id;
    const hash = crypto.createHash('sha256').update(fileBufferHex).digest('hex');

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
EOF

rm -f .git/index.lock && git add app.js && git commit -m "Switch app.js to ES modules" && git push -u origin HEAD
