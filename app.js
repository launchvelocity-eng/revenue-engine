import express from 'express';
import pkg from 'pg';
import cors from 'cors';

const { Pool } = pkg;

// 1. Initialize Express first
const app = express();
const PORT = process.env.PORT || 10000;

// 2. Setup CORS middleware
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

// 4. Gatekeeper Validation Route
app.post('/api/auth/validate', async (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'] || req.body?.gatekeeperKey;

  if (!gatekeeperKey) {
    return res.status(401).json({
      authenticated: false,
      error: 'Missing X-Vault-Gatekeeper-Key header.'
    });
  }

  try {
    const result = await pool.query(
      'SELECT id, tenant_name, tier FROM tenant_vaults WHERE vault_key = $1 LIMIT 1',
      [gatekeeperKey]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        authenticated: false,
        error: 'Invalid or expired Gatekeeper Key.'
      });
    }

    const tenant = result.rows[0];
    res.json({
      authenticated: true,
      tenantName: tenant.tenant_name,
      tier: tenant.tier,
      message: 'Gatekeeper authentication successful.'
    });
  } catch (err) {
    console.error('[GATEKEEPER ERROR] Validation failed:', err.message);
    res.status(500).json({ authenticated: false, error: 'Internal server validation error.' });
  }
});

app.use(express.static('public'));

// 5. Start listener
app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
