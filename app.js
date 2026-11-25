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
  await pool.query(
    'CREATE TABLE IF NOT EXISTS revenue_audit (id SERIAL PRIMARY KEY, tier TEXT NOT NULL, amount_cents INTEGER NOT NULL, allocated_vault TEXT NOT NULL, tenant_id TEXT NOT NULL, hardware_key_prefix TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())'
  );
}

function setCorsHeaders(res, origin) {
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  res.set
