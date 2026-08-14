import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';
import crypto from 'crypto';
import cron from 'node-cron';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const { Pool } = pkg;
const app = express();

// Trust proxy for secure headers behind Render's load balancer
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables on startup
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        tier_name VARCHAR(100),
        subscription_status VARCHAR(50) DEFAULT 'inactive',
        mfa_secret VARCHAR(255),
        mfa_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_assets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) REFERENCES users(email),
        encrypted_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database pool initialized and all session tables verified.');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}
initDb();

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required.' });
  req.user = { email: token };
  next();
}

// Subscription tier enforcement middleware
async function requireActiveSubscription(req, res, next) {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });

    const result = await pool.query(
      'SELECT subscription_status, tier_name FROM users WHERE email = $1',
      [req.user.email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const user = result.rows[0];
    if (user.subscription_status !== 'active') {
      return res.status(403).json({ 
        error: 'Active subscription required to access this resource.',
        currentStatus: user.subscription_status 
      });
    }

    req.user.tierName = user.tier_name;
    next();
  } catch (err) {
    console.error('Subscription Check Error:', err);
    res.status(500).json({ error: 'Failed to verify subscription status.' });
  }
}

// 1. Stripe Webhook Route
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    return res.json({ received: true, note: 'Stripe keys pending configuration.' });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecret);
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const tierName = session.metadata?.tierName || 'Tier 1 - Standard';

      if (customerEmail && pool) {
        await pool.query(
          `INSERT INTO users (email, tier_name, subscription_status) 
           VALUES ($1, $2, 'active') 
           ON CONFLICT (email) 
           DO UPDATE SET tier_name = $2, subscription_status = 'active'`,
          [customerEmail, tierName]
        );
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const customerEmail = invoice.customer_email;

      if (customerEmail && pool) {
        await pool.query(
          `UPDATE users SET subscription_status = 'past_due' WHERE email = $1`,
          [customerEmail]
        );
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// 2. MFA Setup Route
app.post('/api/mfa/setup', authenticateToken, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ name: `RevenueEngine (${req.user.email})` });
    
    if (pool) {
      await pool.query(
        'UPDATE users SET mfa_secret = $1 WHERE email = $2',
        [secret.base32, req.user.email]
      );
    }

    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) return res.status(500).json({ error: 'Failed to generate MFA QR code.' });
      res.json({ success: true, secret: secret.base32, qrCodeUrl: dataUrl });
    });
  } catch (err) {
    console.error('MFA Setup Error:', err);
    res.status(500).json({ error: 'Failed to initialize MFA setup.' });
  }
});

// 3. MFA Verification Route
app.post('/api/mfa/verify', authenticateToken, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'MFA token is required.' });

  try {
    let userSecret = '';
    if (pool) {
      const userQuery = await pool.query('SELECT mfa_secret FROM users WHERE email = $1', [req.user.email]);
      if (userQuery.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
      userSecret = userQuery.rows[0].mfa_secret;
    }

    const verified = speakeasy.totp.verify({
      secret: userSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (!verified) return res.status(400).json({ error: 'Invalid MFA token.' });

    if (pool) {
      await pool.query('UPDATE users SET mfa_enabled = true WHERE email = $1', [req.user.email]);
    }

    res.json({ success: true, message: 'MFA successfully enabled.' });
  } catch (err) {
    console.error('MFA Verification Error:', err);
    res.status(500).json({ error: 'Failed to verify MFA token.' });
  }
});

// 4. Secure Asset Retrieval Route
app.get('/api/secure-assets', authenticateToken, async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });

    const result = await pool.query(
      'SELECT id, encrypted_data, created_at FROM user_assets WHERE email = $1 ORDER BY created_at DESC',
      [req.user.email]
    );

    res.json({
      success: true,
      assets: result.rows.map(row => ({
        id: row.id,
        payload: JSON.parse(row.encrypted_data),
        createdAt: row.created_at
      }))
    });
  } catch (err) {
    console.error('Error fetching secure assets:', err);
    res.status(500).json({ error: 'Failed to retrieve secure assets.' });
  }
});

// 5. Protected Premium Store Route
app.post('/api/secure-store', authenticateToken, requireActiveSubscription, async (req, res) => {
  const { encryptedPayload } = req.body;
  if (!encryptedPayload) {
    return res.status(400).json({ error: 'Encrypted payload is required.' });
  }

  try {
    await pool.query(
      'INSERT INTO user_assets (email, encrypted_data) VALUES ($1, $2)',
      [req.user.email, JSON.stringify(encryptedPayload)]
    );

    res.json({ success: true, message: 'Encrypted asset safely stored in vault.' });
  } catch (err) {
    console.error('Secure Store Error:', err);
    res.status(500).json({ error: 'Failed to store secure asset.' });
  }
});

// 6. Background Cron Job: Run daily at midnight to check subscription health
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily subscription maintenance check...');
  try {
    if (!pool) return;

    const result = await pool.query(
      `UPDATE users 
       SET subscription_status = 'expired' 
       WHERE subscription_status = 'past_due' 
       AND created_at < NOW() - INTERVAL '30 days'`
    );
    
    console.log(`Maintenance complete. Updated ${result.rowCount} expired accounts.`);
  } catch (err) {
    console.error('Subscription Maintenance Cron Error:', err);
  }
});

// Server Listener Binding explicitly to 0.0.0.0 for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
