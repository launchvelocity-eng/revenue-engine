import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import Stripe from 'stripe';
import { Resend } from 'resend';

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://launchvelocity-eng.github.io/revenue-engine';

app.use(helmet());
app.use(cors({ origin: [FRONTEND_URL, 'https://launchvelocity-eng.github.io', 'http://localhost:3000'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json({ limit: '5mb' }));

// Optional PostgreSQL Pool with SSL fallback
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const TIERS = {
  starter: { name: 'Starter', priceCents: 4900, priceId: process.env.STRIPE_PRICE_STARTER },
  growth: { name: 'Growth', priceCents: 14900, priceId: process.env.STRIPE_PRICE_GROWTH }
};

// Health & Pre-Warm Endpoint
app.get(['/', '/health'], async (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Launch Velocity Revenue Engine', db: Boolean(pool) });
});

// Waitlist & Email Verification
app.post('/api/waitlist', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    if (pool) {
      await pool.query('CREATE TABLE IF NOT EXISTS waitlist (id SERIAL PRIMARY KEY, email TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())');
      await pool.query('INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email.trim().toLowerCase()]);
    }
    if (resend) {
      await resend.emails.send({
        from: process.env.RESEND_FROM || 'Launch Velocity <onboarding@resend.dev>',
        to: email.trim(),
        subject: 'Launch Velocity — Access Verified',
        html: '<h2>Welcome to Launch Velocity</h2><p>Your priority vault access is confirmed.</p>'
      });
    }
    res.json({ ok: true, message: 'Verified and added to Launch Velocity' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe Subscription Checkout (Starter $49 / Growth $149)
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    const tierKey = String(req.body?.tier || 'starter').toLowerCase();
    const tier = TIERS[tierKey] || TIERS.starter;
    const lineItem = tier.priceId
      ? { price: tier.priceId, quantity: 1 }
      : { price_data: { currency: 'usd', product_data: { name: `Launch Velocity ${tier.name}` }, unit_amount: tier.priceCents, recurring: { interval: 'month' } }, quantity: 1 };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [lineItem],
      success_url: `${FRONTEND_URL}?checkout=success&tier=${tierKey}`,
      cancel_url: `${FRONTEND_URL}?checkout=cancel`
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ZeroTrustMagicByteShield + Gatekeeper Upload Check
app.post('/api/vault/inspect', (req, res) => {
  const gateKey = req.headers['x-vault-gatekeeper-key'];
  if (process.env.VAULT_GATEKEEPER_KEY && gateKey !== process.env.VAULT_GATEKEEPER_KEY) {
    return res.status(401).json({ error: 'Invalid X-Vault-Gatekeeper-Key' });
  }
  const { hexHeader = '' } = req.body || {};
  const blockedPrefixes = ['4d5a', '7f454c46', 'cafebabe']; // EXE, ELF, Mach-O
  const cleanHex = String(hexHeader).toLowerCase().replace(/\s+/g, '');
  if (blockedPrefixes.some((sig) => cleanHex.startsWith(sig))) {
    return res.status(403).json({ safe: false, shield: 'ZeroTrustMagicByteShield', reason: 'Executable binary blocked' });
  }
  res.json({ safe: true, shield: 'ZeroTrustMagicByteShield', status: 'Cleared' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Launch Velocity API live on port ${PORT}`);
});
