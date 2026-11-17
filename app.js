import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import Stripe from 'stripe';
import { Resend } from 'resend';

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://launchvelocity-eng.github.io';

app.use(helmet());
app.use(cors({
  origin: [
    'https://launchvelocity-eng.github.io',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const PRICING_TIERS = {
  starter: { name: 'Starter Engine', priceCents: 19900 },
  growth: { name: 'Growth Suite', priceCents: 49900 },
  enterprise: { name: 'Enterprise Core', priceCents: 99900 }
};

app.use(express.json());

app.get(['/', '/health'], (_req, res) => {
  res.status(200).json({ status: 'OPERATIONAL', service: 'Launch Velocity Revenue Engine', db: Boolean(pool) });
});

app.post('/api/billing/create-checkout', async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    
    const tierId = String(req.body?.tierId || req.body?.tier || 'starter').toLowerCase();
    const tier = PRICING_TIERS[tierId] || PRICING_TIERS.starter;
    const customerEmail = req.body?.customerEmail ? String(req.body.customerEmail).trim() : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      metadata: { tierId, tierName: tier.name },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Launch Velocity ' + tier.name },
          unit_amount: tier.priceCents,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      success_url: FRONTEND_URL + '/revenue-engine/?checkout=success&tier=' + tierId,
      cancel_url: FRONTEND_URL + '/revenue-engine/?checkout=cancel'
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('[LAUNCH VELOCITY] API live on port ' + PORT);
});
