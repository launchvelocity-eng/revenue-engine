import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Database Initialization
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('Database pool initialized.');
} else {
  console.log('Warning: DATABASE_URL not found.');
}

// Routes
app.post('/api/signup', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  res.json({ success: true });
});

// Server Listener (Must be at the very bottom)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
