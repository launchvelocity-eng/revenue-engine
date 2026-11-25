import http from 'node:http';
import pg from 'pg';

const { Pool } = pg;

const PORT = Number(process.env.PORT || 10000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://launchvelocity-eng.github.io';
const EXPECTED_HARDWARE_KEY = process.env.HARDWARE_KEY || 'LV-KEY-B826EA2203EAACCA';

const TIER_CONFIG = {
  starter: { amountCents: 19900, label: 'Starter Engine', vault: '0.5 TB' },
  growth: { amountCents: 49900, label: 'Growth Suite', vault: '2.0 TB' },
  enterprise: { amountCents: 99900, label: 'Enterprise Core', vault: '5.0 TB' },
  retained: { amountCents: 250000, label: 'Enterprise Retainer', vault: '10.0 TB' }
};

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    })
  : null;

async function ensureAuditTable() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS revenue_audit (
      id SERIAL PRIMARY KEY,
      tier TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      allocated_vault TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      hardware_key_prefix TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

function setCorsHeaders(res, origin) {
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hardware-key, x-tenant-id');
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlPath = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && (urlPath === '/' || urlPath === '/health')) {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'revenue-engine',
      port: PORT,
      dbConnected: Boolean(pool)
    });
  }

  if (req.method === 'POST' && urlPath === '/api/v1/create-checkout-session') {
    const hwKey = String(req.headers['x-hardware-key'] || '').trim();
    if (hwKey !== EXPECTED_HARDWARE_KEY) {
      return sendJson(res, 401, { error: 'Invalid or missing x-hardware-key' });
    }

    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }

    const requestedTier = String(body.tier || 'retained').toLowerCase();
    const tierSpec = TIER_CONFIG[requestedTier] || TIER_CONFIG.retained;
    const tenantId = String(req.headers['x-tenant-id'] || 'enterprise-default');

    try {
      await ensureAuditTable();
      if (pool) {
        await pool.query(
          `INSERT INTO revenue_audit (tier, amount_cents, allocated_vault, tenant_id, hardware_key_prefix)
           VALUES ($1, $2, $3, $4, $5)`,
          [requestedTier, tierSpec.amountCents, tierSpec.vault, tenantId, hwKey.slice(0, 12)]
        );
      }

      return sendJson(res, 200, {
        ok: true,
        tier: requestedTier,
        tierLabel: tierSpec.label,
        amountCents: tierSpec.amountCents,
        allocatedVault: tierSpec.vault,
        tenantId
      });
    } catch (err) {
      console.error('Checkout session error:', err);
      return sendJson(res, 500, { error: 'Failed to record settlement session' });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on ${PORT}`);
});
