import express from 'express';
import pg from 'pg';

const app = express();
const PORT = process.env.PORT || 10000;
const KEY = 'LV-KEY-B826EA2203EAACCA';

process.on('uncaughtException', (err) => console.error('UNCAUGHT:', err));
process.on('unhandledRejection', (err) => console.error('UNHANDLED:', err));

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://launchvelocity-eng.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-hardware-key, x-tenant-id');
  return req.method === 'OPTIONS' ? res.sendStatus(204) : next();
});
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'revenue-engine' }));

app.post('/api/v1/create-checkout-session', async (req, res) => {
  if (req.header('x-hardware-key') !== KEY) return res.status(403).json({ error: 'Invalid Hardware Key' });
  const tier = req.body?.tier || 'retained';
  const map = { starter: [19900, '0.5 TB'], growth: [49900, '2.0 TB'], enterprise: [99900, '5.0 TB'], retained: [250000, '10.0 TB'] };
  const [amount, allocatedVault] = map[tier] || map.retained;
  try {
    if (pool) {
      await pool.query('CREATE TABLE IF NOT EXISTS revenue_audit (id SERIAL PRIMARY KEY, tenant_id TEXT, tier TEXT, amount INT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW())');
      await pool.query('INSERT INTO revenue_audit (tenant_id, tier, amount, status) VALUES ($1,$2,$3,$4)', [req.header('x-tenant-id') || 'enterprise-default', tier, amount, 'PENDING_SETTLEMENT']);
    }
    res.json({ url: 'https://checkout.stripe.com/pay/lv-session', status: 'AUTHORIZED', tier, allocatedVault });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log('Listening on ' + PORT));
