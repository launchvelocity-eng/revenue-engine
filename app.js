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

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const TIERS = {
  starter: { name: 'Starter Engine', priceCents: 9900, priceId: process.env.STRIPE_PRICE_STARTER },
  growth: { name: 'Growth Suite', priceCents: 29900, priceId: process.env.STRIPE_PRICE_GROWTH },
  enterprise: { name: 'Enterprise Core', priceCents: 99900, priceId: process.env.STRIPE_PRICE_ENTERPRISE }
};

// 1. STRIPE WEBHOOK
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) return res.status(503).send('Stripe not configured');
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = process.env.STRIPE_WEBHOOK_SECRET
        ? stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
        : JSON.parse(req.body.toString());
    } catch (err) {
      return res.status(400).send('Webhook Error: ' + err.message);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        const email = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
        const tierName = session.metadata?.tierName || 'Starter Engine';

        if (pool && email) {
          await pool.query('CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, email TEXT UNIQUE, tier TEXT, stripe_session_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW())');
          await pool.query('INSERT INTO customers (email, tier, stripe_session_id) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET tier = EXCLUDED.tier, stripe_session_id = EXCLUDED.stripe_session_id', [email, tierName, session.id]);
        }

        if (resend && email) {
          await resend.emails.send({
            from: process.env.RESEND_FROM || 'Launch Velocity <onboarding@resend.dev>',
            to: [email, 'launchvelocityadmin2026@gmail.com'],
            subject: 'Launch Velocity - Verified Purchase (' + tierName + ')',
            html: '<h2>Payment Confirmed</h2><p><strong>' + email + '</strong> successfully paid for <strong>' + tierName + '</strong>.</p>'
          });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.use(express.json({ limit: '5mb' }));

// 2. HEALTH CHECK
app.get(['/', '/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Launch Velocity Revenue Engine', db: Boolean(pool) });
});

// 3. CREATE CHECKOUT SESSION
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    const tierKey = String(req.body?.tier || 'starter').toLowerCase();
    const customerEmail = req.body?.email ? String(req.body.email).trim() : undefined;
    const tier = TIERS[tierKey] || TIERS.starter;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      metadata: { tierKey, tierName: tier.name },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Launch Velocity ' + tier.name },
          unit_amount: tier.priceCents,
          recurring: { interval
