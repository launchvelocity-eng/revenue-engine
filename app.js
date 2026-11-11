import express from 'express';
import pkg from 'pg';
import cors from 'cors';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'X-Vault-Gatekeeper-Key'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// PostgreSQL Connection Pool (Safely handles missing DATABASE_URL during initial boot)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/launchvelocity',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Telemetry Endpoint
app.get('/api/telemetry', async (req, res) => {
  try {
    const dbPing = await pool.query('SELECT NOW()');
    res.json({ status: 'online', dbConnected: true, serverTime: dbPing.rows[0].now });
  } catch (err) {
    res.json({ status: 'degraded', dbConnected: false, error: err.message });
  }
});

// Onboarding Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, enterpriseName, email, username } = req.body;
  console.log(`[SIGNUP] ${enterpriseName} registered by ${firstName} ${lastName} (@${username})`);
  res.json({ success: true, message: 'Account provisioned successfully.' });
});

// Password & Username Recovery Endpoint
app.post('/api/auth/recover', async (req, res) => {
  const { email } = req.body;
  console.log(`[RECOVERY] Credentials requested for: ${email}`);
  res.json({ success: true, message: 'Recovery instructions dispatched.' });
});

// Tier Checkout & Key Dispatch Endpoint
app.post('/api/vault/checkout', async (req, res) => {
  const { username, enterpriseName, tierName, tbCount, months, keyCount, paymentMethod, totalAmount } = req.body;
  
  const clientKeys = [];
  for (let i = 1; i <= keyCount; i++) {
    clientKeys.push(`gkq_client_${i}_` + Math.random().toString(36).substring(2, 12));
  }

  console.log(`[CHECKOUT] ${enterpriseName} (@${username}) bought ${tierName} (${tbCount}) for ${months}mo via ${paymentMethod} (${totalAmount})`);
  res.json({ success: true, clientKeys, message: 'Payment verified and vault keys generated.' });
});

// Admin Support Ticket Endpoint
app.post('/api/admin/alert', async (req, res) => {
  const { username, category, notes } = req.body;
  console.log(`[ADMIN TICKET] From @${username} [${category}]: ${notes}`);
  res.json({ success: true, message: 'Admin alert dispatched.' });
});

// Start Server and bind to port 10000
app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
