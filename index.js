import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';
import crypto from 'crypto';

const { Pool } = pkg;
const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 50,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

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

const resend = new Resend(process.env.RESEND_API_KEY);
const verificationStore = new Map();

// Cryptographic / Auth Helpers
const JWT_SECRET = process.env.JWT_SECRET_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;

function generateToken(email, tierName) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ email, tierName, exp: Date.now() + (24 * 60 * 60 * 1000) })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
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

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  const user = verifyToken(token);
  if (!user) return res.status(403).json({ error: 'Invalid or expired token.' });

  req.user = user;
  next();
}

function encryptData(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Fetch available storage tiers and add-on rates
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

// Calculate total cost including extra GB add-ons
app.post('/api/calculate-storage', async (req, res) => {
  const { tierName, extraGb } = req.body;
  if (!tierName) {
    return res.status(400).json({ error: 'Tier name is required.' });
  }

  try {
    const tierQuery = await pool.query('SELECT * FROM storage_tiers WHERE tier_name = $1', [tierName]);
    const addonQuery = await pool.query('SELECT * FROM add_on_pricing');

    if (tierQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Tier not found.' });
    }

    const tier = tierQuery.rows[0];
    const ratePerGb = addonQuery.rows.length > 0 ? parseFloat(addonQuery.rows[0].price_per_gb_monthly) : 1.00;
    
    const additionalGb = parseInt(extraGb) || 0;
    const additionalCost = additionalGb * ratePerGb;
    const totalMonthly = parseFloat(tier.price_monthly) + additionalCost;

    res.json({
      success: true,
      tier: tier.tier_name,
      basePrice: tier.price_monthly,
      includedStorageGb: tier.storage_gb,
      extraGbRequested: additionalGb,
      extraGbCostMonthly: additionalCost,
      totalMonthlyPrice: totalMonthly
    });
  } catch (err) {
    console.error('Calculation Error:', err);
    res.status(500).json({ error: 'Failed to calculate storage cost.' });
  }
});

// Select Tier and Issue JWT Token
app.post('/api/select-tier', async (req, res) => {
  const { email, tierName } = req.body;
  if (!email || !tierName) {
    return res.status(400).json({ error: 'Email and tier selection are required.' });
  }

  try {
    const tierQuery = await pool.query('SELECT * FROM storage_tiers WHERE tier_name = $1', [tierName]);
    if (tierQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Selected storage tier not found.' });
    }
    const tier = tierQuery.rows[0];

    if (pool) {
      await pool.query(
        'INSERT INTO users (email, tier_name) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET tier_name = $2',
        [email, tier.tier_name]
      );
    }

    const token = generateToken(email, tier.tier_name);

    res.json({ 
      success: true, 
      message: `Successfully registered for ${tier.tier_name}!`,
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
    res.status(500).json({ error: 'Failed to process tier selection.' });
  }
});

// Protected Secure Asset Storage Route (Requires JWT)
app.post('/api/secure-store', authenticateToken, async (req, res) => {
  const { dataPayload } = req.body;
  if (!dataPayload) {
    return res.status(400).json({ error: 'Data payload is required.' });
  }

  try {
    const encryptedPayload = encryptData(dataPayload);
    if (pool) {
      await pool.query(
        'INSERT INTO user_assets (email, tier_name, encrypted_data) VALUES ($1, $2, $3)',
        [req.user.email, req.user.tierName, encryptedPayload]
      );
    }
    res.json({ success: true, message: 'Data encrypted and stored securely under authenticated tiered protocols.' });
  } catch (err) {
    console.error('Security Storage Error:', err);
    res.status(500).json({ error: 'Failed to process secure storage.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
