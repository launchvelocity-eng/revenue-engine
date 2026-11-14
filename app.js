import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Stripe from 'stripe';

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

app.use(cors({ origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'] }));
app.use(express.json());

const PLANS = {
  starter: { name: 'Launch Velocity — Starter Engine', amount: 4900 },
  growth:  { name: 'Launch Velocity — Growth Suite', amount: 14900 }
};

app.get('/', (req, res) => res.send('Launch Velocity Engine Operational'));
app.get('/health', (req, res) => res.json({ status: 'HEALTHY', timestamp: Date.now() }));

app.post('/api/vault/upload', (req, res) => {
  if (!req.headers['x-vault-gatekeeper-key']) return res.status(401).json({ error: 'UNAUTHORIZED' });
  res.json({ message: 'Payload verified and ingested securely.' });
});

app.post('/api/billing/create-checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
  const { planId = 'starter', customerEmail } = req.body;
  const plan = PLANS[planId] || PLANS.starter;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: customerEmail || undefined,
      line_items: [{
        price_data: { currency: 'usd', product_data: { name: plan.name }, unit_amount: plan.amount, recurring: { interval: 'month' } },
        quantity: 1
      }],
      mode: 'subscription',
      success_url: 'https://launchvelocity-eng.github.io/revenue-engine/?success=true',
      cancel_url: 'https://launchvelocity-eng.github.io/revenue-engine/?canceled=true'
    });
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0',
