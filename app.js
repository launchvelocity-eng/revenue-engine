import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import Stripe from 'stripe';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'launch_velocity_super_secure_secret_key_2026';
const ADMIN_ALERT_EMAIL = 'launchvelocityadmin2026@gmail.com';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Vault-Gatekeeper-Key'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[POSTGRES POOL ERROR]:', err.message);
});

// Root & Telemetry
app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', service: 'Launch Velocity Revenue Engine' });
});

// ZERO-TRUST BACKEND PAYMENT CHECKOUT SESSION
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, error: 'Stripe gateway not configured on server.' });
    }

    const { months = 1, extraTB = 0, enterpriseName } = req.body || {};

    // STRICT SERVER-SIDE PRICE CALCULATION (Prevents browser tampering)
    const baseAmountPerMonth = 2500; // $2,500 / mo base (includes 2 TB)
    const extraTBPricePerTB = 1000;   // +$1,000 per extra TB
    
    const calculatedTotalUSD = (months * baseAmountPerMonth) + (extraTB * extraTBPricePerTB);
    const amountInCents = calculatedTotalUSD * 100;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'], // Supports Corporate Cards & ACH Wire
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Launch Velocity Enterprise Vault (${2 + extraTB} TB)`,
              description: `Air-Gapped Zero-Trust Storage Lease (${months} Month${months > 1 ? 's' : ''}) for ${enterpriseName || 'Enterprise Client'}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://launchvelocity-eng.github.io/revenue-engine/?payment=success',
      cancel_url: 'https://launchvelocity-eng.github.io/revenue-engine/?payment=cancelled',
    });

    console.log(`[STRIPE CHECKOUT] Session created for ${enterpriseName}: $${calculatedTotalUSD}.00`);
    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('[STRIPE ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Registration & Signin endpoints remain here...
