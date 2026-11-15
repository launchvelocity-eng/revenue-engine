import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import Stripe from 'stripe';
import { Resend } from 'resend';

// 1. Initialize express app FIRST
const app = express();

// 2. Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// ... (your routes and endpoints go here) ...

// 3. Listen at the very bottom
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Launch Velocity API live on port ${PORT}`);
});
