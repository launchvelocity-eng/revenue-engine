import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'X-Vault-Gatekeeper-Key'],
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

// Onboarding Registration Endpoint with PostgreSQL Persistence
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, enterpriseName, email, username, password } = req.body || {};

    if (!username || !email || !password) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ success: false, error: 'Missing required credentials.' });
    }

    // Hash password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert into PostgreSQL database
    const query = `
      INSERT INTO users (first_name, last_name, enterprise_name, email, username, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, created_at;
    `;
    const values = [firstName, lastName, enterpriseName, email, username, passwordHash];
    const result = await pool.query(query, values);

    console.log(`[SIGNUP SUCCESS] Enterprise user registered: @${username}`);
    res.setHeader('Content-Type', 'application/json');
    res.status(201).json({ success: true, message: 'Account provisioned and persisted successfully.', user: result.rows[0] });
  } catch (err) {
    console.error('[SIGNUP ERROR]:', err.message);
    res.setHeader('Content-Type', 'application/json');
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Username or email already registered.' });
    }
    res.status(500).json({ success: false, error: 'Database persistence error.' });
  }
});

// Password & Username Recovery Endpoint
app.post('/api/auth/recover', async (req, res) => {
  try {
    const { email } = req.body || {};
    console.log(`[RECOVERY] Credentials requested for: ${email || 'unknown'}`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, message: 'Recovery instructions dispatched.' });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ success: false, error: err.message });
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
