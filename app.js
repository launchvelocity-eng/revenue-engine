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

// Safe Resend initialization so missing env var never crashes startup
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

pool.on('error', (err) => {
  console.error('[POSTGRES POOL ERROR]:', err.message);
});

// Root Health Check (Prevents Render health check timeouts)
app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', service: 'Launch Velocity Revenue Engine' });
});

// Telemetry Endpoint
app.get('/api/telemetry', async (req, res) => {
  try {
    const dbPing = await pool.query('SELECT NOW()');
    res.json({ status: 'online', dbConnected: true, serverTime: dbPing.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'degraded', dbConnected: false, error: err.message });
  }
});

// Registration Endpoint (Customer Confirmation + Admin Alert)
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
    const values = [firstName || '', lastName || '', enterpriseName || 'Enterprise', email, username, passwordHash
