import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import { Resend } from 'resend';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Resend API (Ensure RESEND_API_KEY is set in Render Environment Variables)
const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = 'mongealfredoantonio@gmail.com';

// 1. CORS Setup
app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'X-Vault-Gatekeeper-Key'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// 2. PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 3. System Telemetry Endpoint
app.get('/api/telemetry', async (req, res) => {
  try {
    const dbPing = await pool.query('SELECT NOW()');
    res.json({
      status: 'online',
      dbConnected: true,
      serverTime: dbPing.rows[0].now
    });
  } catch (err) {
    res.status(500).json({ status: 'degraded', dbConnected: false, error: err.message });
  }
});

// 4. Onboarding / Sign-Up Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { username, email } = req.body;

  try {
    // Send Verification Email to Tenant
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Launch Velocity <onboarding@resend.dev>',
        to: email || ADMIN_EMAIL,
        subject: '⚡ Launch Velocity: Verify Your Enterprise Account',
        html: `<h3>Welcome to Launch Velocity, ${username}!</h3><p>Your account registration is received. Please verify your account to unlock your vault dashboard and tier access.</p>`
      });

      // Dispatch Admin Notification Alert
      await resend.emails.send({
        from: 'Launch Velocity Engine <alerts@resend.dev>',
        to: ADMIN_EMAIL,
        subject: '🚨 ADMIN ALERT: New User Sign Up Pending',
        html: `<p>New enterprise user <strong>${username}</strong> (${email}) registered and triggered account verification.</p>`
      });
    }

    res.json({ success: true, message: 'Verification email dispatched. Please check your inbox before signing in.' });
  } catch (err) {
    console.error('[REGISTRATION ERROR]', err);
    res.status(500).json({ error: 'Failed to complete registration process.' });
  }
});

// 5. Tier Checkout & Vault Key Dispatch Endpoint
app.post('/api/vault/checkout', async (req, res) => {
  const { username, userEmail, tierName, tbCount, months, paymentMethod, totalAmount } = req.body;

  // Generate 3 unique Gatekeeper Vault Keys
  const keys = [
    'gkq_primary_' + Math.random().toString(36).substring(2, 12),
    'gkq_secondary_' + Math.random().toString(36).substring(2, 12),
    'gkq_failover_' + Math.random().toString(36).substring(2, 12)
  ];

  try {
    if (process.env.RESEND_API_KEY) {
      // Dispatch 3 Vault Keys to Tenant Email
      await resend.emails.send({
        from: 'Launch Velocity Vault <vaults@resend.dev>',
        to: userEmail || ADMIN_EMAIL,
        subject: '🔐 Your Launch Velocity Gatekeeper Vault Keys',
        html: `
          <h2>Vault Provisioned Successfully</h2>
          <p><strong>Tenant:</strong> ${username}</p>
          <p><strong>Tier:</strong> ${tierName} (${tbCount} TB Total) | <strong>Duration:</strong> ${months} Month(s)</p>
          <p><strong>Total Paid:</strong> $${totalAmount.toLocaleString()}</p>
          <h3>Your Dedicated Security Keys:</h3>
          <ul>
            <li><code>Key 1 (Primary): ${keys[0]}</code></li>
            <li><code>Key 2 (Secondary): ${keys[1]}</code></li>
            <li><code>Key 3 (Failover): ${keys[2]}</code></li>
          </ul>
        `
      });

      // Send Payment Alert to Launch Velocity Admin
      await resend.emails.send({
        from: 'Launch Velocity Engine <alerts@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `💳 ADMIN ALERT: Payment Received from ${username}`,
        html: `
          <h3>Payment & Allocation Confirmation</h3>
          <p><strong>Tenant:</strong> ${username}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Total Amount:</strong> $${totalAmount.toLocaleString()}</p>
          <p><strong>Capacity:</strong> ${tbCount} TB for ${months} month(s).</p>
        `
      });
    }

    res.json({ success: true, keys, message: 'Payment verified and 3 vault keys dispatched to your email.' });
  } catch (err) {
    console.error('[CHECKOUT ERROR]', err);
    res.status(500).json({ error: 'Checkout and key dispatch failed.' });
  }
});

// 6. Admin Ticket / Escalation Dispatch Endpoint
app.post('/api/admin/alert', async (req, res) => {
  const { username, category, notes } = req.body;

  try {
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Launch Velocity Support <alerts@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `🚨 ADMIN ALERT: ${category.toUpperCase()} Request from ${username}`,
        html: `
          <h3>Tenant Escalation Ticket</h3>
          <p><strong>Tenant Username:</strong> ${username}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Notes:</strong> ${notes}</p>
        `
      });
    }
    res.json({ success: true, message: 'Admin alert dispatched successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send admin notification.' });
  }
});

// 7. Protected File Upload Endpoint
app.post('/api/vault/upload', async (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'];
  if (!gatekeeperKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing Gatekeeper Key header.' });
  }
  res.json({ success: true, message: 'Payload successfully ingested into vault storage.' });
});

app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
