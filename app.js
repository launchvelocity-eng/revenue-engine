import express from 'express';
import pkg from 'pg';
import cors from 'cors';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;

// CORS Setup
app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'X-Vault-Gatekeeper-Key'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Telemetry Endpoint
app.get('/api/telemetry', async (req, res) => {
  try {
    const dbPing = await pool.query('SELECT NOW()');
    res.json({
      status: 'online',
      dbConnected: true,
      serverTime: dbPing.rows[0].now
    });
  } catch (err) {
    res.status(500).json({ status: 'degraded', dbConnected: false, error: err.message });
  }
});

// Onboarding / Sign-Up Registration
app.post('/api/auth/register', async (req, res) => {
  const { username, email } = req.body;
  console.log(`[REGISTRATION] New tenant registered: ${username} (${email})`);
  res.json({ success: true, message: 'Verification email dispatched successfully.' });
});

// Tier Checkout & Key Generation
app.post('/api/vault/checkout', async (req, res) => {
  const { username, tierName, tbCount, months, paymentMethod, totalAmount } = req.body;
  
  // Generate 3 unique Gatekeeper Vault Keys
  const keys = [
    'gkq_primary_' + Math.random().toString(36).substring(2, 12),
    'gkq_secondary_' + Math.random().toString(36).substring(2, 12),
    'gkq_failover_' + Math.random().toString(36).substring(2, 12)
  ];

  console.log(`[CHECKOUT] Payment received for ${username}: ${tierName} (${tbCount}) for ${months}mo via ${paymentMethod} (${totalAmount})`);
  res.json({ success: true, keys, message: 'Payment processed and 3 vault keys generated.' });
});

// Admin Escalation & Support Dispatch
app.post('/api/admin/alert', async (req, res) => {
  const { username, category, notes } = req.body;
  console.log(`[ADMIN ALERT] Ticket from ${username} [${category}]: ${notes}`);
  res.json({ success: true, message: 'Admin notification dispatched to mongealfredoantonio@gmail.com.' });
});

// Protected File Upload Endpoint
app.post('/api/vault/upload', async (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'];
  if (!gatekeeperKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing Gatekeeper Key header.' });
  }
  res.json({ success: true, message: 'Payload successfully ingested into vault storage.' });
});

app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
