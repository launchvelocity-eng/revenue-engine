import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Stripe from 'stripe';

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Launch Velocity Engine live'));
app.get('/health', (req, res) => res.json({ status: 'HEALTHY' }));

app.post('/api/vault/upload', (req, res) => {
  if (!req.headers['x-vault-gatekeeper-key']) return res.status(401).json({ error: 'UNAUTHORIZED' });
  res.json({ message: 'Verified' });
});

app.post('/api/billing/create-checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'NO_STRIPE' });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Vault' }, unit_amount: 250000 }, quantity: 1 }],
      mode: 'payment',
      success_url: 'https://launchvelocity-eng.github.io/revenue-engine/?success=true',
      cancel_url: 'https://launchvelocity-eng.github.io/revenue-engine/?canceled=true',
    });
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Listening on ${PORT}`));
