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
const ADMIN_ALERT_EMAIL = 'launchvelocityadmin2026@gmail.com';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Vault-Gatekeeper-Key'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[POSTGRES POOL ERROR]:', err.message);
});

app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', service: 'Launch Velocity Revenue Engine' });
});

app.get('/api/telemetry', async (req, res) => {
  try {
    const dbPing = await pool.query('SELECT NOW()');
    res.json({ status: 'online', dbConnected: true, serverTime: dbPing.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'degraded', dbConnected: false, error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, enterpriseName, email, username, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Missing required credentials.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (first_name, last_name, enterprise_name, email, username, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, created_at;
    `;
    const values = [firstName || '', lastName || '', enterpriseName || 'Enterprise', email, username, passwordHash];
    const result = await pool.query(query, values);

    if (resend) {
      try {
        await resend.emails.send({
          from: 'Launch Velocity <onboarding@resend.dev>',
          to: email,
          subject: 'Welcome to Launch Velocity — Enterprise Vault Confirmed',
          html: `<div style="background:#020617;color:#f8fafc;padding:24px;font-family:sans-serif;">
            <h2 style="color:#22d3ee;">Hello ${firstName || username},</h2>
            <p>Your enterprise vault node for <strong>${enterpriseName || 'your organization'}</strong> has been confirmed and provisioned.</p>
            <p><strong>Username:</strong> @${username}</p>
            <p>Sign in to your dashboard to select your storage tier and provision your encrypted keys.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px;">&copy; 2026 Launch Velocity Enterprise Platform</p>
          </div>`
        });
      } catch (userEmailErr) {
        console.error('[USER EMAIL WARNING]:', userEmailErr.message);
      }

      try {
        await resend.emails.send({
          from: 'Launch Velocity Alerts <onboarding@resend.dev>',
          to: ADMIN_ALERT_EMAIL,
          subject: `New Enterprise Sign-Up: ${enterpriseName || username}`,
          html: `<div style="background:#020617;color:#f8fafc;padding:24px;font-family:sans-serif;">
            <h2 style="color:#22c55e;">New Enterprise Registration Alert</h2>
            <p><strong>Company / Enterprise:</strong> ${enterpriseName || 'N/A'}</p>
            <p><strong>Contact:</strong> ${firstName || ''} ${lastName || ''} (${email})</p>
            <p><strong>Username:</strong> @${username}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>`
        });
      } catch (adminEmailErr) {
        console.error('[ADMIN ALERT WARNING]:', adminEmailErr.message);
      }
    }

    console.log(`[SIGNUP SUCCESS] Enterprise user registered: @${username}`);
    res.status(201).json({
      success: true,
      message: 'Account provisioned and confirmation emails dispatched.',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('[SIGNUP ERROR]:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Username or email already registered.' });
    }
    res.status(500).json({ success: false, error: 'Database persistence error.' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required.' });
    }

    const userQuery = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const user = userQuery.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });

    console.log(`[SIGNIN SUCCESS] User authenticated: @${user.username}`);
    res.json({ success: true, token, username: user.username, enterprise: user.enterprise_name });
  } catch (err) {
    console.error('[SIGNIN ERROR]:', err.message);
    res.status(500).json({ success: false, error: 'Authentication server error.' });
  }
});

app.post('/api/auth/recover', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address required.' });
    }

    if (resend) {
      await resend.emails.send({
        from: 'Launch Velocity <onboarding@resend.dev>',
        to: email,
        subject: 'Vault Node Credential Recovery',
        html: `<div style="background:#020617;color:#f8fafc;padding:24px;font-family:sans-serif;">
          <h2 style="color:#22d3ee;">Credential Recovery Notice</h2>
          <p>A recovery dispatch was requested for your enterprise vault node associated with this email.</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px;">&copy; 2026 Launch Velocity Platform</p>
        </div>`
      });
    }

    console.log(`[RECOVERY SUCCESS] Dispatched to: ${email}`);
    res.json({ success: true, message: 'Recovery instructions dispatched to inbox.' });
  } catch (err) {
    console.error('[RECOVERY ERROR]:', err.message);
    res.status(500).json({ success: false, error: 'Recovery dispatch error.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint Not Found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
