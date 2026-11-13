import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { z } from 'zod';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const PORT = process.env.PORT || 10000;

// 1. Strict Security Headers Middleware (Render & CSP Protection)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.stripe.com;"
  );
  next();
});

app.use(cors());

// 2. Stripe Webhook Endpoint (Must use express.raw() to verify cryptographic signatures)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET is not set. Skipping signature verification.');
    return res.status(200).json({ received: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful subscription or payment events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`✅ Payment successful for session ID: ${session.id}`);
    // TODO: Trigger Resend email telemetry or database provisioning here
  }

  // Return fast 200 OK to prevent Stripe timeout retries
  res.status(200).json({ received: true });
});

// JSON parser for standard API routes
app.use(express.json());

// Zod validation schema for checkout payloads
const checkoutSchema = z.object({
  plan: z.enum(['starter', 'growth', 'enterprise']),
  email: z.string().email().optional()
});

// Health check endpoint for Render keep-alive pings
app.get('/', (req, res) => {
  res.status(200).send('Launch Velocity Revenue Engine is live 🚀');
});

// 3. Checkout Session Route
app.post('/create-checkout-session', async (req, res) => {
  try {
    const validation = checkoutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request parameters', details: validation.error.format() });
    }

    const { plan, email } = validation.data;

    // Map plans to your actual Stripe Price IDs
    const priceMap = {
      starter: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_placeholder',
      growth: process.env.STRIPE_GROWTH_PRICE_ID || 'price_growth_placeholder',
      enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder'
    };

    const priceId = priceMap[plan];

    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://launchvelocity-eng.github.io/revenue-engine/?success=true',
      cancel_url: 'https://launchvelocity-eng.github.io/revenue-engine/?canceled=true',
    };

    if (email) {
      sessionConfig.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('❌ Checkout session creation error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Launch Velocity Engine listening on port ${PORT}`);
});
