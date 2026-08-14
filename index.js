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

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/', limiter);

const resend = new Resend(process.env.RESEND_API_KEY || 're_123');
const pendingSignups = new Map();

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('Database pool initialized.');
}

const initDB = async () => {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS secure_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        tier_level INT DEFAULT 1,
        account_status VARCHAR(50) DEFAULT 'waitlist',
        storage_allocated_gb INT DEFAULT 1,
        last_payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_billing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    client.release();
  }
};
initDB();

// Native background audit check (Runs every 24 hours)
setInterval(async () => {
  if (!pool) return;
  console.log('Running daily billing & retention audit...');
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE secure_users 
      SET account_status = 'locked' 
      WHERE account_status = 'active' 
      AND next_billing_date < NOW() - INTERVAL '4 days'
    `);

    const purgedUsers = await client.query(`
      UPDATE secure_users 
      SET account_status = 'purged', storage_allocated_gb = 0 
      WHERE account_status = 'locked' 
      AND next_billing_date < NOW() - INTERVAL '30 days'
      RETURNING email
    `);
    
    console.log(`Audit complete. Purged ${purgedUsers.rowCount} abandoned accounts.`);
  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    client.release();
  }
}, 24 * 60 * 60 * 1000);

app.post('/api/signup', async (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingSignups.set(email.toLowerCase().trim(), code);
  
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Your LaunchVelocity Verification Code',
      html: `<p>Your secure code is: <strong>${code}</strong></p>`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/verify', async (req, res) => {
  const { email, code, tierLevel = 1 } = req.body;
  const cleanEmail = email?.toLowerCase().trim();

  if (pendingSignups.get(cleanEmail) === code) {
    pendingSignups.delete(cleanEmail);
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO secure_users (email, tier_level, account_status) 
           VALUES ($1, $2, 'waitlist') 
           ON CONFLICT (email) DO UPDATE SET tier_level = EXCLUDED.tier_level`,
          [cleanEmail, tierLevel]
        );
      } finally {
        client.release();
      }
    }
    return res.json({ success: true, assignedTier: tierLevel });
  }
  res.status(400).json({ error: 'Invalid verification code' });
});

app.post('/api/dashboard', async (req, res) => {
  const { email } = req.body;
  if (!pool) return res.status(500).json({ error: 'DB not connected' });
  
  const client = await pool.connect();
  try {
    const user = await client.query(
      `SELECT tier_level, account_status, storage_allocated_gb, next_billing_date 
       FROM secure_users WHERE email = $1`, 
      [email.toLowerCase().trim()]
    );
    
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, data: user.rows[0] });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); Import express from 'express';
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

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/', limiter);

const resend = new Resend(process.env.RESEND_API_KEY || 're_123');
const pendingSignups = new Map();

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('Database pool initialized.');
}

const initDB = async () => {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS secure_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        tier_level INT DEFAULT 1,
        account_status VARCHAR(50) DEFAULT 'waitlist',
        storage_allocated_gb INT DEFAULT 1,
        last_payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_billing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    client.release();
  }
};
initDB();

// Native background audit check (Runs every 24 hours)
setInterval(async () => {
  if (!pool) return;
  console.log('Running daily billing & retention audit...');
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE secure_users 
      SET account_status = 'locked' 
      WHERE account_status = 'active' 
      AND next_billing_date < NOW() - INTERVAL '4 days'
    `);

    const purgedUsers = await client.query(`
      UPDATE secure_users 
      SET account_status = 'purged', storage_allocated_gb = 0 
      WHERE account_status = 'locked' 
      AND next_billing_date < NOW() - INTERVAL '30 days'
      RETURNING email
    `);
    
    console.log(`Audit complete. Purged ${purgedUsers.rowCount} abandoned accounts.`);
  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    client.release();
  }
}, 24 * 60 * 60 * 1000);

app.post('/api/signup', async (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingSignups.set(email.toLowerCase().trim(), code);
  
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Your LaunchVelocity Verification Code',
      html: `<p>Your secure code is: <strong>${code}</strong></p>`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/verify', async (req, res) => {
  const { email, code, tierLevel = 1 } = req.body;
  const cleanEmail = email?.toLowerCase().trim();

  if (pendingSignups.get(cleanEmail) === code) {
    pendingSignups.delete(cleanEmail);
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO secure_users (email, tier_level, account_status) 
           VALUES ($1, $2, 'waitlist') 
           ON CONFLICT (email) DO UPDATE SET tier_level = EXCLUDED.tier_level`,
          [cleanEmail, tierLevel]
        );
      } finally {
        client.release();
      }
    }
    return res.json({ success: true, assignedTier: tierLevel });
  }
  res.status(400).json({ error: 'Invalid verification code' });
});

app.post('/api/dashboard', async (req, res) => {
  const { email } = req.body;
  if (!pool) return res.status(500).json({ error: 'DB not connected' });
  
  const client = await pool.connect();
  try {
    const user = await client.query(
      `SELECT tier_level, account_status, storage_allocated_gb, next_billing_date 
       FROM secure_users WHERE email = $1`, 
      [email.toLowerCase().trim()]
    );
    
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, data: user.rows[0] });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
