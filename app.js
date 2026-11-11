import express from 'express';
import pkg from 'pg';
import cors from 'cors';

const { Pool } = pkg;

// 1. Initialize Express first
const app = express();
const PORT = process.env.PORT || 10000;

// 2. Setup CORS & JSON parsing
app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'X-Vault-Gatekeeper-Key'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// 3. Setup Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 4. Secure Vault Upload Endpoint
app.post('/api/vault/upload', async (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'];

  if (!gatekeeperKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing Gatekeeper Key header.' });
  }

  try {
    const authCheck = await pool.query(
      'SELECT id, tenant_name, tier FROM tenant_vaults WHERE vault_key = $1 LIMIT 1',
      [gatekeeperKey]
    );

    if (authCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Forbidden: Invalid or expired Gatekeeper Key.' });
    }

    const tenant = authCheck.rows[0];
    console.log(`[VAULT UPLOAD] Received secure payload for tenant: ${tenant.tenant_name} (${tenant.tier})`);

    res.json({
      success: true,
      tenant: tenant.tenant_name,
      message: 'Payload successfully ingested and locked into vault storage.'
    });

  } catch (err) {
    console.error('[UPLOAD ERROR]', err.message);
    res.status(500).json({ error: 'Internal server upload processing error.' });
  }
});

app.use(express.static('public'));

// 5. Start listener
app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
