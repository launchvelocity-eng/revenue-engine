import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';
import crypto from 'crypto';
import cron from 'node-cron';

const { Pool } = pkg;
const app = express(); // <-- Must be instantiated right here first!

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());

// Now the webhook route can safely use 'app'
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    return res.json({ received: true, note: 'Stripe keys pending configuration.' });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecret);
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const tierName = session.metadata?.tierName || 'Tier 1 - Standard';

      if (customerEmail && pool) {
        await pool.query(
          `INSERT INTO users (email, tier_name, subscription_status) 
           VALUES ($1, $2, 'active') 
           ON CONFLICT (email) 
           DO UPDATE SET tier_name = $2, subscription_status = 'active'`,
          [customerEmail, tierName]
        );
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const customerEmail = invoice.customer_email;

      if (customerEmail && pool) {
        await pool.query(
          `UPDATE users SET subscription_status = 'past_due' WHERE email = $1`,
          [customerEmail]
        );
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
