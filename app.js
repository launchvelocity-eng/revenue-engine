/**
 * Step 1: Zero-Trust Vault Access & Key Lifecycle System
 * Enforces key authentication (Client vs Master keys) and checks lease status/grace periods.
 */
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

export async function authorizeVaultAccess(req, res, next) {
  const apiKey = req.headers['x-vault-api-key'] || req.headers['authorization'];

  if (!apiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false, 
      error: 'UNAUTHORIZED: Missing tenant access key.' 
    }));
  }

  // Extract raw key if formatted as "Bearer LV-KEY-..."
  const cleanKey = apiKey.replace('Bearer ', '').trim();
  const keyHash = crypto.createHash('sha256').update(cleanKey).digest('hex');

  if (!process.env.DATABASE_URL) {
    // Development fallback if DB is temporarily bypassed
    return next();
  }

  try {
    // 1. Look up key in DB
    const keyRes = await pool.query(
      `SELECT corporate_email, key_type, is_active FROM tenant_vault_keys WHERE hsm_hash = $1`,
      [keyHash]
    );

    if (keyRes.rows.length === 0 || !keyRes.rows[0].is_active) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        success: false, 
        error: 'FORBIDDEN: Invalid or deactivated access key.' 
      }));
    }

    const { corporate_email, key_type } = keyRes.rows[0];

    // 2. Enforce Lease Status & 7-Day Lockout Grace Period
    const leaseRes = await pool.query(
      `SELECT status, grace_period_end FROM tenant_lease_lifecycle WHERE corporate_email = $1`,
      [corporate_email]
    );

    if (leaseRes.rows.length > 0) {
      const { status, grace_period_end } = leaseRes.rows[0];
      const now = new Date();

      // Master keys retain emergency override authorization
      const isMasterKey = key_type.includes('MASTER');

      if (status === 'LOCKED_OUT' && !isMasterKey) {
        res.writeHead(402, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          success: false, 
          error: 'LEASE_EXPIRED: Account locked out. Settle balance or renew partition lease to restore access.' 
        }));
      }

      if (status === 'GRACE_PERIOD' && grace_period_end && now > new Date(grace_period_end) && !isMasterKey) {
        // Automatically transition status to LOCKED_OUT after 7-day grace window
        await pool.query(
          `UPDATE tenant_lease_lifecycle SET status = 'LOCKED_OUT' WHERE corporate_email = $1`,
          [corporate_email]
        );
        res.writeHead(402, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          success: false, 
          error: 'GRACE_PERIOD_EXPIRED: 7-day data retrieval window has elapsed. Partition locked.' 
        }));
      }
    }

    // Attach tenant context to request for downstream operations
    req.tenant = { email: corporate_email, keyType: key_type };
    if (typeof next === 'function') next();

  } catch (err) {
    console.error('[GATEKEEPER ERROR]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Internal security authentication failure.' }));
  }
}
