import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import Stripe from 'stripe';
import { Resend } from 'resend';

// 1. CREATE EXPRESS APP FIRST (Must be before any app.use or app.get)
const app = express();

const PORT = Number(process.env.PORT) || 10000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://launchvelocity-eng.github.io/revenue-engine';

// 2. MIDDLEWARE & SECURITY
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

// 3. WEB
