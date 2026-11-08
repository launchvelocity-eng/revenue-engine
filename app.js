import http from 'http';
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

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

        const tenantKeyId = 'LV-KEY-' + crypto.randomBytes(8).toString('hex').toUpperCase();

        // 1. Save to Database
        if (process.env.DATABASE_URL) {
          try {
            await pool.query(
              `INSERT INTO enterprise_tenants (company_name, corporate_email, tenant_key_id, hsm_key_hash) 
               VALUES ($1, $2, $3, $4) 
               ON CONFLICT (corporate_email) DO NOTHING`,
              [company, email, tenantKeyId, 'placeholder_hash']
            );
          } catch (dbErr) {
            console.error('DB Insert error:', dbErr.message);
          }
        }

        // 2. Send Emails via Resend API
        if (process.env.RESEND_API_KEY) {
          const resendHeaders = {
            'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          };

          try {
            // A. Admin Alerts (dispatched to both admin inboxes)
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: resendHeaders,
              body: JSON.stringify({
                from: 'Launch Velocity Security <onboarding@resend.dev>',
                to: ['Launchvelocityadmin2026@gmail.com', 'mongealfredoantonio@gmail.com'],
                subject: '🚨 New Waitlist Signup: ' + company,
                html: `<p>New registration received from <strong>${email}</strong> (${company}).</p><p>Tenant Key: <code>${tenantKeyId}</code></p>`
              })
            });

            // B. User Confirmation Email
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
            console.error('Email alert error:', mailErr.message);
          }
        } else {
          console.warn('RESEND_API_KEY environment variable is not defined.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tenantKeyId: tenantKeyId }));
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
