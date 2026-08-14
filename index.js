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

// Rate limiting for API security
const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 50,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Database Pool Setup
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('Database pool initialized.');
}

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory code store for quick verification handling (or store in DB)
const verificationStore = new Map();

// Step 1: Request Verification Code & Send Email
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

// Step 2: Verify Code and Save to Tier
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
    verificationStore.delete(email);
    res.json({ success: true, message: 'Successfully verified and added to waitlist!' });
  } catch (err) {
    console.error('Database Error:', err);
    res.status(500).json({ error: 'Database error processing verification.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
