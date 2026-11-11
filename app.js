import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'launch_velocity_super_secure_secret_key_2026';
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Vault-Gatekeeper-Key'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Telemetry Endpoint
app.get('/api/telemetry', async (req, res) => {
  try {
    const dbPing = await pool.query('SELECT NOW()');
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'online', dbConnected: true, serverTime: dbPing.rows[0].now });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ status: 'degraded', dbConnected: false, error: err.message });
  }
});

// Registration Endpoint with Email Confirmation
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, enterpriseName, email, username, password } = req.body || {};

    if (!username || !email || !password) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ success: false, error: 'Missing required credentials.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (first_name, last_name, enterprise_name, email, username, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, created_at;
    `;
    const values = [firstName, lastName, enterpriseName, email, username, passwordHash];
    const result = await pool.query(query, values);

    // Send Welcome Email via Resend API
    try {
      await resend.emails.send({
        from: 'Launch Velocity <onboarding@resend.dev>',
        to: email,
        subject: 'Enterprise Vault Node Provisioned',
        html: `<div style="background:#020617;color:#f8fafc;padding:24px;font-family:sans-serif;">
          <h2 style="color:#22d3ee;">Launch Velocity Enterprise Vault</h2>
          <p>Hello ${firstName}, your enterprise node for <strong>${enterpriseName}</strong> has been successfully provisioned.</p>
          <p>Username: <strong>@${username}</strong></p>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px;">&copy; 2026 Launch Velocity Platform</p>
        </div>`
      });
    } catch (emailErr) {
      console.error('[EMAIL WARNING]: Failed to dispatch welcome email:', emailErr.message);
    }

    console.log(`[SIGNUP SUCCESS] Enterprise user registered: @${username}`);
    res.setHeader('Content-Type', 'application/json');
    res.status(201).json({ success: true, message: 'Account provisioned and welcome email dispatched.', user: result.rows[0] });
  } catch (err) {
    console.error('[SIGNUP ERROR]:', err.message);
    res.setHeader('Content-Type', 'application/json');
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Username or email already registered.' });
    }
    res.status(500).json({ success: false, error: 'Database persistence error.' });
  }
});

// Sign In Endpoint
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ success: false, error: 'Username and password required.' });
    }

    const userQuery = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
    if (userQuery.rows.length === 0) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const user = userQuery.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });

    console.log(`[SIGNIN SUCCESS] User authenticated: @${user.username}`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, token, username: user.username, enterprise: user.enterprise_name });
  } catch (err) {
    console.error('[SIGNIN ERROR]:', err.message);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ success: false, error: 'Authentication server error.' });
  }
});

// Password Recovery Endpoint with Resend API
app.post('/api/auth/recover', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ success: false, error: 'Email address required.' });
    }

    // Send Recovery Email via Resend API
    await resend.emails.send({
      from: 'Launch Velocity <recovery@resend.dev>',
      to: email,
      subject: 'Vault Node Credential Recovery',
      html: `<div style="background:#020617;color:#f8fafc;padding:24px;font-family:sans-serif;">
        <h2 style="color:#22d3ee;">Credential Recovery Notice</h2>
        <p>A recovery dispatch was requested for your enterprise vault node associated with this email.</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px;">&copy; 2026 Launch Velocity Platform</p>
      </div>`
    });

    console.log(`[RECOVERY SUCCESS] Dispatched to: ${email}`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, message: 'Recovery instructions dispatched to inbox.' });
  } catch (err) {
    console.error('[RECOVERY ERROR]:', err.message);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ success: false, error: 'Recovery dispatch error.' });
  }
});

// Fallback 404 handler
app.use((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({ success: false, error: 'Endpoint Not Found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
