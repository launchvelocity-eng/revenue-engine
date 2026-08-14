import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';
import crypto from 'crypto';
import cron from 'node-cron';

const { Pool } = pkg;
const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  pool.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      tier_level VARCHAR(50) NOT NULL,
      verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS storage_tiers (
      id SERIAL PRIMARY KEY,
      tier_name VARCHAR(50) UNIQUE NOT NULL,
      price_monthly DECIMAL(10, 2) NOT NULL,
      storage_gb INTEGER NOT NULL,
      retention_days INTEGER NOT NULL,
      security_level VARCHAR(50) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS add_on_pricing (
      id SERIAL PRIMARY KEY,
      unit_type VARCHAR(50) NOT NULL,
      price_per_gb_monthly DECIMAL(10, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      tier_name VARCHAR(50) NOT NULL,
      subscription_status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token_id VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_assets (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      tier_name VARCHAR(50) NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).then(async () => {
    const tierCheck = await pool.query('SELECT COUNT(*) FROM storage_tiers');
    if (parseInt(tierCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO storage_tiers (tier_name, price_monthly, storage_gb, retention_days, security_level)
        VALUES 
        ('Tier 1 - Standard', 9.99, 100, 365, 'AES-256'),
        ('Tier 2 - Professional', 29.99, 500, 730, 'AES-256 + MFA'),
        ('Tier 3 - Enterprise', 75000.00, 2000, 180, 'AES-256 + MFA + Hardware-HSM');
      `);
      console.log('Default storage tiers seeded successfully.');
    }

    const addonCheck = await pool.query('SELECT COUNT(*) FROM add_on_pricing');
    if (parseInt(addonCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO add_on_pricing (unit_type, price_per_gb_monthly)
        VALUES ('Extra GB Storage', 1.00);
      `);
      console.log('Add-on pricing seeded successfully.');
    }

    console.log('Database pool initialized and all tables verified.');
  }).catch(err => {
    console.error('Error setting up database tables:', err);
  });
}

// --- Step 6: Stripe Webhook Endpoint (Must use raw body parsing) ---
// Note: Ensure you have STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY set in your Render environment variables.
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // If Stripe keys are not yet configured, gracefully acknowledge to prevent retries during staging
  if (!stripeSecret || !webhookSecret) {
    console.log('Stripe environment keys not configured yet. Skipping webhook signature verification.');
    return res.json({ received: true, note: 'Stripe keys pending configuration.' });
  }

  let event;
  try {
    // Dynamically require stripe if installed
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecret);
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle specific Stripe billing events
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
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
          console.log(`Webhook: Successfully provisioned subscription for ${customerEmail} to ${tierName}`);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerEmail = invoice.customer_email;

        if (customerEmail && pool) {
          await pool.query(
            `UPDATE users SET subscription_status = 'past_due' WHERE email = $1`,
            [customerEmail]
          );
          console.log(`Webhook: Payment failed for ${customerEmail}. Marked status as past_due.`);
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error processing webhook event data:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// Standard JSON parsing middleware for all other API routes
app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 50,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

const JWT_SECRET = process.env.JWT_SECRET_KEY || crypto.randomBytes(32).toString('hex');

function generateToken(email, tierName) {
  const tokenId = crypto.randomBytes(16).toString('hex');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ email, tierName, jti: tokenId, exp: Date.now() + (24 * 60 * 60 * 1000) })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return { token: `${header}.${payload}.${signature}`, tokenId, expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) };
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    if (signature !== expectedSignature) return null;
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decodedPayload.exp < Date.now()) return null;
    return decodedPayload;
  } catch (err) {
    return null;
  }
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  const user = verifyToken(token);
  if (!user) return res.status(403).json({ error: 'Invalid or expired token.' });

  if (pool) {
    try {
      const sessionQuery = await pool.query('SELECT * FROM user_sessions WHERE token_id = $1 AND expires_at > NOW()', [user.jti]);
      if (sessionQuery.rows.length === 0) {
        return res.status(403).json({ error: 'Session revoked or expired in database.' });
      }
      
      // Check if subscription is still active
      const userQuery = await pool.query('SELECT subscription_status FROM users WHERE email = $1', [user.email]);
      if (userQuery.rows.length > 0 && userQuery.rows[0].subscription_status === 'past_due') {
        return res.status(403).json({ error: 'Subscription payment past due. Access restricted.' });
      }
    } catch (err) {
      console.error('Session/Subscription check error:', err);
    }
  }

  req.user = user;
  next();
}

app.get('/api/tiers', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not connected' });
    const tiersResult = await pool.query('SELECT * FROM storage_tiers ORDER BY price_monthly ASC');
    const addonResult = await pool.query('SELECT * FROM add_on_pricing');
    
    res.json({ 
      success: true, 
      tiers: tiersResult.rows,
      addOnRate: addonResult.rows[0] || { price_per_gb_monthly: 1.00 }
    });
  } catch (err) {
    console.error('Error fetching tiers:', err);
    res.status(500).json({ error: 'Failed to fetch storage tiers.' });
  }
});

app.post('/api/calculate-storage', async (req, res) => {
  const { tierName, extraGb } = req.body;
  if (!tierName) return res.status(400).json({ error: 'Tier name is required.' });

  try {
    const tierQuery = await pool.query('SELECT * FROM storage_tiers WHERE tier_name = $1', [tierName]);
    const addonQuery = await pool.query('SELECT * FROM add_on_pricing');

    if (tierQuery.rows.length === 0) return res.status(404).json({ error: 'Tier not found.' });

    const tier = tierQuery.rows[0];
    const ratePerGb = addonQuery.rows.length > 0 ? parseFloat(addonQuery.rows[0].price_per_gb_monthly) : 1.00;
    const additionalGb = parseInt(extraGb) || 0;
    const totalMonthly = parseFloat(tier.price_monthly) + (additionalGb * ratePerGb);

    res.json({
      success: true,
      tier: tier.tier_name,
      basePrice: tier.price_monthly,
      totalMonthlyPrice: totalMonthly
    });
  } catch (err) {
    console.error('Calculation Error:', err);
    res.status(500).json({ error: 'Failed to calculate storage cost.' });
  }
});

app.post('/api/select-tier', async (req, res) => {
  const { email, tierName } = req.body;
  if (!email || !tierName) return res.status(400).json({ error: 'Email and tier selection are required.' });

  try {
    const tierQuery = await pool.query('SELECT * FROM storage_tiers WHERE tier_name = $1', [tierName]);
    if (tierQuery.rows.length === 0) return res.status(404).json({ error: 'Selected storage tier not found.' });
    const tier = tierQuery.rows[0];

    if (pool) {
      await pool.query(
        'INSERT INTO users (email, tier_name, subscription_status) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET tier_name = $2',
        [email, tier.tier_name, 'active']
      );
    }

    const { token, tokenId, expiresAt } = generateToken(email, tier.tier_name);
    const clientIp = req.ip || req.socket.remoteAddress;

    if (pool) {
      await pool.query(
        'INSERT INTO user_sessions (email, token_id, ip_address, expires_at) VALUES ($1, $2, $3, $4)',
        [email, tokenId, clientIp, expiresAt]
      );
    }

    res.json({ 
      success: true, 
      message: `Successfully registered and session initialized for ${tier.tier_name}!`,
      token,
      details: {
        price: tier.price_monthly,
        storage: tier.storage_gb,
        retention: tier.retention_days,
        security: tier.security_level
      }
    });
  } catch (err) {
    console.error('Tier Selection Error:', err);
    res.status(500).json({ error: 'Failed to process tier selection and session logging.' });
  }
});

app.post('/api/secure-store', authenticateToken, async (req, res) => {
  const { zeroKnowledgePayload } = req.body;
  if (!zeroKnowledgePayload || !zeroKnowledgePayload.ciphertext) {
    return res.status(400).json({ error: 'Zero-knowledge encrypted payload is required.' });
  }

  try {
    const rawBundleString = JSON.stringify(zeroKnowledgePayload);

    if (pool) {
      await pool.query(
        'INSERT INTO user_assets (email, tier_name, encrypted_data) VALUES ($1, $2, $3)',
        [req.user.email, req.user.tierName, rawBundleString]
      );
    }
    res.json({ success: true, message: 'Zero-knowledge encrypted asset stored successfully on server.' });
  } catch (err) {
    console.error('Zero-Knowledge Storage Error:', err);
    res.status(500).json({ error: 'Failed to process zero-knowledge storage.' });
  }
});

cron.schedule('0 0 * * *', async () => {
  console.log('Running daily data retention cleanup cron job...');
  if (!pool) return;
  
  try {
    const result = await pool.query(`
      DELETE FROM user_assets ua
      USING storage_tiers st
      WHERE ua.tier_name = st.tier_name
      AND ua.created_at < NOW() - (st.retention_days || ' days')::INTERVAL
      RETURNING ua.id;
    `);
    console.log(`Retention Cleanup Complete: Purged ${result.rowCount} expired assets.`);
  } catch (err) {
    console.error('Error during data retention cleanup:', err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
