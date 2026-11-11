import express from 'express';
import pkg from 'pg';
import cors from 'cors';

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
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/launchvelocity',
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

// Onboarding Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, enterpriseName, email, username } = req.body || {};
    console.log(`[SIGNUP] ${enterpriseName || 'Enterprise'} registered by ${firstName || ''} ${lastName || ''} (@${username || 'user'})`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, message: 'Account provisioned successfully.' });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ success: false, error: err.message });
  }
});

// Password & Username Recovery Endpoint
app.post('/api/auth/recover', async (req, res) => {
  try {
    const { email } = req
