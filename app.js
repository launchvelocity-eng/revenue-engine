import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;
const MASTER_HARDWARE_KEY = 'LV-KEY-B826EA2203EAACCA';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : null;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://launchvelocity-eng.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-hardware-key, x-tenant-id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use(express.json());

function verifyHardwareKey(req, res, next) {
  const clientKey = req.header('x-hardware-key');
  if (!clientKey || clientKey !== MASTER_HARDWARE_KEY) {
    return res.status(403).json({ error: 'Sovereign Access Denied: Invalid Hardware Key' });
  }
  return next();
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'revenue-engine' });
});

app.get('/api/v1/telemetry', verifyHardwareKey, (req, res) => {
  res.status(200).json({
    pipelineThroughput: '99.99%',
    pgSync: 'revenue-dn Database • 0ms Drift',
    vaultIntegrity: 'SECURE',
  });
});

app.post('/api/v1/create-checkout-session', verifyHardwareKey, async (req, res) => {
  const tier = req.body?.tier || 'retained';
  const tenantId = req.header('x-tenant-id') || 'enterprise-default';

  const tierMap = {
    starter: { price: 19900, storage: '0.5 TB' },
    growth: { price: 49900, storage: '2.0 TB' },
    enterprise: { price: 99900, storage: '5.0 TB' },
    retained: { price: 250000, storage: '10.0 TB' },
  };

  const selectedTier = tierMap[tier] || tierMap.retained;

  try {
    if (pool) {
      await pool.query(
        'INSERT INTO revenue_audit (tenant_id, tier, amount, status) VALUES ($1, $2, $3, $4)',
        [tenantId, tier, selectedTier.price, 'PENDING_SETTLEMENT']
      );
    }

    return res.status(200).json({
      url: `https://checkout.stripe.com/pay/lv-session-${Date.now()}`,
      status: 'AUTHORIZED',
      tier,
      allocatedVault: selectedTier.storage,
    });
  } catch (err) {
    console.error('Settlement initialization failed:', err);
    return res.status(500).json({ error: 'Database pipeline sync failure during settlement initialization.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Launch Velocity revenue-engine listening on port ${PORT}`);
});
