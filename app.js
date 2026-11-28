import http from 'node:http';
import pg from 'pg';

const PORT = Number(process.env.PORT || 10000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://launchvelocity-eng.github.io';
const EXPECTED_HARDWARE_KEY = process.env.HARDWARE_KEY || 'LV-KEY-B826EA2203EAACCA';

const TIERS = {
  starter: { amountCents: 19900, label: 'Starter Engine', vault: '0.5 TB' },
  growth: { amountCents: 49900, label: 'Growth Suite', vault: '2.0 TB' },
  enterprise: { amountCents: 99900, label: 'Enterprise Core', vault: '5.0 TB' },
  retained: { amountCents: 250000, label: 'Enterprise Retainer', vault: '10.0 TB' }
};

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

const send = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin === ALLOWED_ORIGIN ? req.headers.origin : ALLOWED_ORIGIN;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hardware-key, x-tenant-id');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const path = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && (path === '/' || path === '/health')) {
    return send(res, 200, { ok: true, service: 'revenue-engine', port: PORT, dbConnected: Boolean(pool) });
  }

  if (req.method === 'POST' && path === '/api/v1/create-checkout-session') {
    const hwKey = String(req.headers['x-hardware-key'] || '').trim();
    if (hwKey !== EXPECTED_HARDWARE_KEY) return send(res, 401, { error: 'Invalid or missing x-hardware-key' });

    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return send(res, 400, { error: 'Invalid JSON body' });
    }

    const tierKey = String(body.tier || 'retained').toLowerCase();
    const tier = TIERS[tierKey] || TIERS.retained;
    const tenantId = String(req.headers['x-tenant-id'] || 'enterprise-default');

    try {
      if (pool) {
        await pool.query(
          'CREATE TABLE IF NOT EXISTS revenue_audit (id SERIAL PRIMARY KEY, tier TEXT NOT NULL, amount_cents INTEGER NOT NULL, allocated_vault TEXT NOT NULL, tenant_id TEXT NOT NULL, hardware_key_prefix TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())'
        );
        await pool.query(
          'INSERT INTO revenue_audit (tier, amount_cents, allocated_vault, tenant_id, hardware_key_prefix) VALUES ($1, $2, $3, $4, $5)',
          [tierKey, tier.amountCents, tier.vault, tenantId, hwKey.slice(0, 12)]
        );
      }

      return send(res, 200, {
        ok: true,
        tier: tierKey,
        tierLabel: tier.label,
        amountCents: tier.amountCents,
        allocatedVault: tier.vault,
        tenantId
      });
    } catch (err) {
      return send(res, 500, { error: err.message || 'Database error' });
    }
  }

  return send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Listening on ${PORT}`));
