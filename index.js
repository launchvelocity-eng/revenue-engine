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

    CREATE TABLE IF NOT EXISTS user_assets (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      tier_name VARCHAR(50) NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).then(async () => {
    const check = await pool.query('SELECT COUNT(*) FROM storage_tiers');
    if (parseInt(check.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO storage_tiers (tier_name, price_monthly, storage_gb, retention_days, security_level)
        VALUES 
        ('Tier 1 - Standard', 9.99, 100, 365, 'AES-256'),
        ('Tier 2 - Professional', 29.99, 500, 730, 'AES-256 + MFA'),
        ('Tier 3 - Enterprise', 99.99, 2000, 3650, 'AES-256 + MFA + Hardware-HSM');
      `);
      console.log('Default storage tiers seeded successfully.');
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

// Fetch available storage tiers
app.get('/api/tiers', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not connected' });
    const result = await pool.query('SELECT * FROM storage_tiers ORDER BY price_monthly ASC');
    res.json({ success: true, tiers: result.rows });
  } catch (err) {
    console.error('Error fetching tiers:', err);
    res.status(500).json({ error: 'Failed to fetch storage tiers.' });
  }
});

// Secure Asset Storage Route
app.post('/api/secure-store', async (req, res) => {
  const { email, dataPayload, tierName } = req.body;
  if (!email || !dataPayload) {
    return res.status(400).json({ error: 'Email and data payload are required.' });
  }

  try {
    const encryptedPayload = encryptData(dataPayload);
    if (pool) {
      await pool.query(
        'INSERT INTO user_assets (email, tier_name, encrypted_data) VALUES ($1, $2, $3)',
        [email, tierName || 'Standard', encryptedPayload]
      );
    }
    res.json({ success: true, message: 'Data encrypted and stored securely under tiered protocols.' });
  } catch (err) {
    console.error('Security Storage Error:', err);
    res.status(500).json({ error: 'Failed to process secure storage.' });
  }
});

app.post('/api/signup', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationStore.set(email, code);

  try {
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Your Verification Code',
        html: `<p>Your verification code is: <strong>${code}</strong></p>`
      });
    }
    res.json({ success: true, message: 'Verification code sent.' });
  } catch (err) {
    console.error('Email Dispatch Error:', err);
    res.status(500).json({ error: 'Failed to send verification email.' });
  }
});

app.post('/api/verify', async (req, res) => {
  const { email, code, tierLevel } = req.body;
  const storedCode = verificationStore.get(email);

  if (!storedCode || storedCode !== code) {
    return res.status(400).json({ error: 'Invalid or expired verification code.' });
  }

  try {
    if (pool) {
      await pool.query(
        'INSERT INTO waitlist (email, tier_level, verified) VALUES ($1, $2, true) ON CONFLICT (email) DO UPDATE SET tier_level = $2, verified = true',
        [email, tierLevel]
      );
    }

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'You are on the waitlist!',
        html: `
          <h2>Verification Confirmed!</h2>
          <p>Thank you for verifying your email. You have been successfully added to our waitlist.</p>
          <p>We will be in touch with you soon with updates, information on database storage fees, security levels, and more.</p>
        `
      });
    }

    verificationStore.delete(email);
    res.json({ success: true, message: 'Successfully verified and added to waitlist!' });
  } catch (err) {
    console.error('Database/Email Error:', err);
    res.status(500).json({ error: 'Error processing verification.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
