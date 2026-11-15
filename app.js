import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Stripe from 'stripe';
import { Resend } from 'resend';

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://launchvelocity-eng.github.io/revenue-engine';

// Built-in Security Headers (Replaces helmet)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Built-in Lightweight Rate Limiter (Replaces express-rate-limit)
const hits = new Map();
app.use((req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, reset: now + 900000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 900000; }
  if (++entry.count > 100) return res.status(429).json({ error: 'Too many requests' });
  hits.set(ip, entry);
  next();
});

app.use(cors({ origin: [FRONTEND_URL, 'https://launchvelocity-eng.github.io', 'http://localhost:3000'] }));
app.use(express.json({ limit: '5mb' }));
