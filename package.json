import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

let pool = null;
try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log('Database pool initialized.');
  }
} catch (e) {
  console.error('Database init error:', e.message);
}

const resend = new Resend(process.env.RESEND_API_KEY || 're_123');
const pendingSignups = new Map();

// Signup Route (Tier 1 Waitlist Entry)
app.post('/api/signup', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingSignups.set(email.toLowerCase().trim(), code);

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'mongealfredoantonio@gmail.com',
      subject: 'LaunchVelocity Code',
      html: `<p>Code: <strong>${code}</strong></p>`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Email dispatch failed' });
  }
});

// Verification Route (Assigns Default Tier 1 on entry)
app.post('/api/verify', async (req, res) => {
  const { email, code, tierLevel = 1 } = req.body;
  const cleanEmail = email?.toLowerCase().trim();

  if (pendingSignups.get(cleanEmail) === code) {
    pendingSignups.delete(cleanEmail);

    if (pool) {
      try {
        const client = await pool.connect();
        // Ensure table supports tier_level
        await client.query(`
          CREATE TABLE IF NOT EXISTS secure_users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            tier_level INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await client.query(
          `INSERT INTO secure_users (email, tier_level) VALUES ($1, $2) 
           ON CONFLICT (email) DO UPDATE SET tier_level = EXCLUDED.tier_level`,
          [cleanEmail, tierLevel]
        );
        client.release();
      } catch (dbErr) {
        console.error('Database save error:', dbErr.message);
      }
    }

    return res.json({ success: true, assignedTier: tierLevel });
  }

  res.status(400).json({ error: 'Invalid verification code' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
