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

    CREATE TABLE IF NOT EXISTS user_assets (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      tier_name VARCHAR(50) NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).then(async () => {
    // Seed default tiers with exclusive Tier 3 pricing
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

    // Seed add-on pricing for extra GBs
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

// Encryption Helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;

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
    const ratePerGb = addonQuery.rows.length > 0 ? parseFloat(addonQuery.rows.rows?.[0]?.price_per_gb_monthly || 1.00) : 1.00;
    
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
