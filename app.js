import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import Stripe from 'stripe';
import { Resend } from 'resend';

// 1. Initialize Express FIRST
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://launchvelocity-eng.github.io/revenue-engine';

app.use(helmet());
app.use(cors({ origin: [FRONTEND_URL, 'https://launchvelocity-eng.github.io', 'http://localhost:3000'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json({ limit: '5mb' }));

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// --- YOUR ROUTES HERE ---
app.get(['/', '/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Launch Velocity Revenue Engine' });
});

// 2. app.listen MUST BE AT THE VERY BOTTOM
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Launch Velocity API live on port ${PORT}`);
});
