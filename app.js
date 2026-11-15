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
app.use(cors());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const TIERS = {
  starter: { name: 'Starter Engine', priceCents: 19900, priceId: process.env.STRIPE_PRICE_STARTER },
  growth: { name: 'Growth Suite', priceCents: 49900, priceId: process.env.STRIPE_PRICE_GROWTH },
  enterprise: { name: 'Enterprise Core', priceCents: 99900, priceId: process.env.STRIPE_PRICE_ENTERPRISE }
};

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) return res.status(503).send('Stripe not configured');
    const sig = req.headers['stripe-signature'];
    const event = process.env.STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
      : JSON.parse(req.body.toString());

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        const email = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
        const tierName = session.metadata?.tierName || 'Starter Engine';
        if (pool && email) {
          await pool.query('CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, email TEXT UNIQUE, tier TEXT, stripe_session_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW())');
          await pool.query('INSERT INTO customers (email, tier, stripe_session_id) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET tier = EXCLUDED.tier', [email, tierName, session.id]);
        }
        if (resend && email) {
          await resend.emails.send({
            from: process.env.RESEND_FROM || 'Launch Velocity <onboarding@resend.dev>',
            to: [email, 'launchvelocityadmin2026@gmail.com'],
            subject: 'Launch Velocity - Verified Purchase (' + tierName + ')',
            html: '<p>Payment confirmed for <strong>' + tierName + '</strong>.</p>'
          });
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).send('Webhook Error: ' + err.message);
  }
});

app.use(express.json());

app.get(['/', '/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Launch Velocity Revenue Engine', db: Boolean(pool) });
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    const tierKey = String(req.body?.tier || 'starter').toLowerCase();
    const tier = TIERS[tierKey] || TIERS.starter;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: req.body?.email ? String(req.body.email).trim() : undefined,
      metadata: { tierKey, tierName: tier.name },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Launch Velocity ' + tier.name },
          unit_amount: tier.priceCents,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      success_url: FRONTEND_URL + '?checkout=success&tier=' + tierKey,
      cancel_url: FRONTEND_URL + '?checkout=cancel'
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscription-status', async (req, res) => {
  try {
    const email = String(req.query?.email || '').trim().toLowerCase();
    if (!email || !pool) return res.json({ registered: false });
    const result = await pool.query('SELECT tier, created_at FROM customers WHERE email = $1 LIMIT 1', [email]);
    if (result.rows.length === 0) return res.json({ registered: false });
    res.json({ registered: true, tier: result.rows[0].tier, activatedAt: result.rows[0].created_at });
  } catch (err) {
    res.status(500).json({ registered: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Launch Velocity API live on port ' + PORT);
});
