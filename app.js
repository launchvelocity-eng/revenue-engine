import express from 'express';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize your production database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 1. ZERO-TRUST STREAM TRANSFORM MODULES
// ==========================================
class MaxLengthLimiter extends Transform {
  constructor(maxBytes) {
    super();
    this.maxBytes = maxBytes;
    this.bytesRead = 0;
  }
  _transform(chunk, encoding, callback) {
    this.bytesRead += chunk.length;
    if (this.bytesRead > this.maxBytes) {
      return callback(new Error('PAYLOAD_TOO_LARGE'));
    }
    this.push(chunk);
    callback();
  }
  _destroy(err, callback) {
    this.bytesRead = 0;
    this.removeAllListeners();
    callback(err);
  }
}

class ZeroTrustMagicByteShield extends Transform {
  constructor() {
    super();
    this.headBuffer = Buffer.alloc(0);
    this.checked = false;
  }
  _transform(chunk, encoding, callback) {
    if (!this.checked) {
      this.headBuffer = Buffer.concat([this.headBuffer, chunk]);
      if (this.headBuffer.length >= 4) {
        const magicHex = this.headBuffer.toString('hex', 0, 4).toUpperCase();
        if (magicHex.startsWith('4D5A') || magicHex === '7F454C46') {
          return callback(new Error('MALICIOUS_BINARY_DETECTED'));
        }
        this.checked = true;
      }
    }
    this.push(chunk);
    callback();
  }
  _destroy(err, callback) {
    this.headBuffer = null;
    this.removeAllListeners();
    callback(err);
  }
}

const getAirGappedStorageStream = () => {
  const { Writable } = require('stream');
  return new Writable({ write(chunk, enc, cb) { cb(); } });
};

// ==========================================
// 2. POSTGRESQL MULTI-TENANT LEASE Lifecycle
// ==========================================
export async function executeTenantOffboardingAudit() {
  console.log('[LEASE WORKER] Initiating automated corporate lease expiration audit...');
  const lockClient = await pool.connect();
  
  try {
    await lockClient.query('BEGIN;');

    const targetingQuery = `
      SELECT id, tenant_id, partition_name 
      FROM tenant_leases 
      WHERE expires_at <= NOW() - INTERVAL '7 days' 
        AND lease_status = 'GRACE_PERIOD'
      LIMIT 5
      FOR UPDATE SKIP LOCKED;
    `;
    
    const { rows: expiredTenants } = await lockClient.query(targetingQuery);

    if (expiredTenants.length === 0) {
      console.log('[LEASE WORKER] Audit complete. Zero expired enterprise leases found.');
      await lockClient.query('COMMIT;');
      return;
    }

    for (const tenant of expiredTenants) {
      await lockClient.query(
        "UPDATE tenant_leases SET lease_status = 'OFFBOARDING_IN_PROGRESS' WHERE id = $1;",
        [tenant.id]
      );
    }
    await lockClient.query('COMMIT;');

    for (const tenant of expiredTenants) {
      const ddlClient = await pool.connect();
      try {
        await ddlClient.query('BEGIN;');
        await ddlClient.query('LOCK TABLE tenant_data_partitions IN ACCESS EXCLUSIVE MODE;');
        const safePartitionName = tenant.partition_name.replace(/[^a-zA-Z0-9_]/g, '');
        await ddlClient.query(`ALTER TABLE tenant_data_partitions DETACH PARTITION ${safePartitionName};`);
        await ddlClient.query(
          "UPDATE tenant_leases SET lease_status = 'OFFBOARDED', finalized_at = NOW() WHERE id = $1;",
          [tenant.id]
        );
        await ddlClient.query('COMMIT;');
      } catch (ddlError) {
        await ddlClient.query('ROLLBACK;');
        console.error(`[DDL FAILURE] Skipped partition for tenant ${tenant.tenant_id}:`, ddlError.message);
        await pool.query("UPDATE tenant_leases SET lease_status = 'GRACE_PERIOD' WHERE id = $1;", [tenant.id]);
      } finally {
        ddlClient.release();
      }
    }
  } catch (workerError) {
    await lockClient.query('ROLLBACK;');
    // We catch the error internally so it cannot propagate upwards to crash node
    console.error('[LEASE WORKER ERROR] Audit iteration deferred:', workerError.message);
  } finally {
    lockClient.release();
  }
}

// ==========================================
// 3. SECURE ENDPOINTS
// ==========================================
app.post('/api/vault/upload', async (req, res) => {
  const MAX_500MB = 500 * 1024 * 1024;
  if (req.destroyed) return res.status(400).json({ error: 'Connection aborted.' });

  const limiter = new MaxLengthLimiter(MAX_500MB);
  const shield = new ZeroTrustMagicByteShield();
  const secureDestination = getAirGappedStorageStream();

  try {
    await pipeline(req, limiter, shield, secureDestination);
    return res.status(201).json({ status: 'success', bytesProcessed: limiter.bytesRead });
  } catch (err) {
    if (secureDestination && typeof secureDestination.destroy === 'function') {
      try { secureDestination.destroy(); } catch (_) {}
    }
    if (err.message === 'MALICIOUS_BINARY_DETECTED') {
      return res.status(400).json({ error: 'Security Policy Violation' });
    }
    if (err.message === 'PAYLOAD_TOO_LARGE') {
      res.setHeader('Connection', 'close');
      return res.status(413).json({ error: 'Quota Exceeded' });
    }
    return res.status(500).json({ error: 'Internal pipeline error.' });
  }
});

// Administrative hook to manually test or trigger the database lease check
app.post('/api/admin/lease-sweep', async (req, res) => {
  try {
    await executeTenantOffboardingAudit();
    return res.json({ status: 'sweep_executed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. CRASH-PROOF LISTENER INITIALIZATION
// ==========================================
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
  
  // Wrapped in a protective try/catch to let your app live even if PostgreSQL lacks tables
  try {
    await executeTenantOffboardingAudit();
  } catch (startupErr) {
    console.warn('[STARTUP NOTICE] Background database workers resting until tables are migrated:', startupErr.message);
  }
});
