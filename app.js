import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { z } from 'zod';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const PORT = process.env.PORT || 10000;

// 1. Strict Security Headers Middleware
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

// 2. Stripe Webhook Endpoint
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
    return res.status(400).send(`Webhook Error: ${
