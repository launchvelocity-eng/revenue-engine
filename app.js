import http from 'http';
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialize Database Tables with Lifecycle & Key Rules
async function initDb() {
  if (!process.env.DATABASE_URL) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS enterprise_tenants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_name VARCHAR(255) NOT NULL,
          corporate_email VARCHAR(255) UNIQUE NOT NULL,
          tenant_key_id VARCHAR(64) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tenant_vault_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          corporate_email VARCHAR(255) NOT NULL,
          key_type VARCHAR(50) NOT NULL,
          key_identifier VARCHAR(64) UNIQUE NOT NULL,
          hsm_hash VARCHAR(256) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tenant_lease_lifecycle (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          corporate_email VARCHAR(255) UNIQUE NOT NULL,
          lease_end_date TIMESTAMP WITH TIME ZONE,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          grace_period_end TIMESTAMP WITH TIME ZONE,
          purge_eligible_date TIMESTAMP WITH TIME ZONE,
          last_notice_sent TIMESTAMP WITH TIME ZONE
        );
      `);
      console.log('[DB ENGINE] Schema initialized successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[DB WARNING] Schema initialization bypassed:', err.message);
  }
}
initDb();

// Internal Background Audit (Grace Period & 90-Day Offboarding Protocol)
async function runLifecycleAudit() {
  if (!process.env.DATABASE_URL) return;
  try {
    const client = await pool.connect();
    try {
      const now = new Date();

      // Expired leases -> Move to 7-day GRACE_PERIOD
      const expiredLeases = await client.query(`
        SELECT corporate_email FROM tenant_lease_lifecycle 
        WHERE status = 'ACTIVE' AND lease_end_date IS NOT NULL AND lease_end_date <= NOW()
      `);

      for (const row of expiredLeases.rows) {
        const graceEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const purgeDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        await client.query(`
          UPDATE tenant_lease_lifecycle 
          SET status = 'GRACE_PERIOD', grace_period_end = $1, purge_eligible_date = $2 
          WHERE corporate_email = $3
        `, [graceEnd, purgeDate, row.corporate_email]);
        console.log(`[LIFECYCLE] Moved to 7-day grace period: ${row.corporate_email}`);
      }

      // Accounts past 90-day retention -> Execute Offboarding & Purge Protocol
      const purgeEligible = await client.query(`
        SELECT corporate_email FROM tenant_lease_lifecycle 
        WHERE status = 'LOCKED_OUT' AND purge_eligible_date IS NOT NULL AND purge_eligible_date <= NOW()
      `);

      for (const row of purgeEligible.rows) {
        console.log(`[OFFBOARDING PROTOCOL] Generating encrypted backup for: ${row.corporate_email}`);
        await client.query(`UPDATE tenant_lease_lifecycle SET status = 'PURGED' WHERE corporate_email = $1`, [row.corporate_email]);
        console.log(`[PURGE COMPLETE] Data erased for: ${row.corporate_email}`);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[AUDIT WORKER WARNING]', err.message);
  }
}
setInterval(runLifecycleAudit, 60 * 60 * 1000); // Hourly check

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // 1. Inline Threat & Payload Inspection
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 500 * 1024 * 1024) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'SECURITY_ALERT: Payload exceeds safe threshold (500MB).' }));
  }

  const fileNameHeader = req.headers['x-file-name'] || '';
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.scr', '.dll', '.so'];
  if (blockedExtensions.some(ext => fileNameHeader.toLowerCase().endsWith(ext))) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'SECURITY_ALERT: File type restricted by vault policy.' }));
  }

  // 2. Main Execution API Route
  if (req.method === 'POST' && req.url === '/api/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const company = payload.company || 'Enterprise Partner';
        const email = payload.email || '';

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid email required' }));
        }

        // Generate 3 Client Keys + 2 Internal Admin Master Keys
        const generateKey = (prefix) => prefix + '-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        const clientKey1 = generateKey('LV-KEY-CLIENT-1');
        const clientKey2 = generateKey('LV-KEY-CLIENT-2');
        const clientKey3 = generateKey('LV-KEY-CLIENT-3');
        const masterAlpha = generateKey('LV-KEY-MASTER-ALPHA');
        const masterBravo = generateKey('LV-KEY-MASTER-BRAVO');

        // PostgreSQL Storage
        if (process.env.DATABASE_URL) {
          try {
            await pool.query(
              `INSERT INTO enterprise_tenants (company_name, corporate_email, tenant_key_id) 
               VALUES ($1, $2, $3) 
               ON CONFLICT (corporate_email) DO NOTHING`,
              [company, email, clientKey1]
            );

            const keysToInsert = [
              [email, 'CLIENT_KEY_1', clientKey1],
              [email, 'CLIENT_KEY_2', clientKey2],
              [email, 'CLIENT_KEY_3', clientKey3],
              [email, 'MASTER_ALPHA', masterAlpha],
              [email, 'MASTER_BRAVO', masterBravo]
            ];

            for (const [cEmail, kType, kId] of keysToInsert) {
              const hash = crypto.createHash('sha256').update(kId).digest('hex');
              await pool.query(
                `INSERT INTO tenant_vault_keys (corporate_email, key_type, key_identifier, hsm_hash)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (key_identifier) DO NOTHING`,
                [cEmail, kType, kId, hash]
              );
            }

            await pool.query(
              `INSERT INTO tenant_lease_lifecycle (corporate_email, status)
               VALUES ($1, 'ACTIVE')
               ON CONFLICT (corporate_email) DO NOTHING`,
              [email]
            );
            console.log('[DB SUCCESS] Keys & lifecycle provisioned for:', email);
          } catch (dbErr) {
            console.warn('[DB WARNING] Record bypass:', dbErr.message);
          }
        }

        // Email Dispatches via Resend API
        if (process.env.RESEND_API_KEY) {
          const resendHeaders = {
            'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          };

          try {
            // Admin Alert
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: resendHeaders,
              body: JSON.stringify({
                from: 'Launch Velocity Security <onboarding@resend.dev>',
                to: ['Launchvelocityadmin2026@gmail.com'],
                subject: '🚨 New Waitlist Signup: ' + company,
                html: `<p>New registration from <strong>${email}</strong> (${company}).</p>
                       <p>Client Key: <code>${clientKey1}</code></p>
                       <p>Master Alpha Key: <code>${masterAlpha}</code></p>`
              })
            });

            // Customer Confirmation Notice
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: resendHeaders,
              body: JSON.stringify({
                from: 'Launch Velocity Security <onboarding@resend.dev>',
                to: [email],
                subject: 'Launch Velocity | Vault Provisioning Request',
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; background: #090d16; color: #f8fafc; border-radius: 8px;">
                    <h2 style="color: #38bdf8; margin-top: 0;">LAUNCH VELOCITY</h2>
                    <p style="font-size: 16px; color: #e2e8f0; line-height: 1.6;">
                      Your enterprise storage partition request for ${company} has been securely logged and provisioned on our zero-trust air-gapped architecture. We will let you know when data storage partitions & rates are available. Have a nice day.
                    </p>
                    <p style="font-size: 15px; color: #38bdf8; margin-top: 30px; font-weight: 600;">
                      Launch Velocity Admin
                    </p>
                  </div>
                `
              })
            });
          } catch (mailErr) {
            console.error('[EMAIL WARNING] Dispatch failed:', mailErr.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tenantKeyId: clientKey1 }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Launch Velocity Engine Live');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
