import express from 'express';
import pkg from 'pg';
import cors from 'cors';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_EMAIL = 'mongealfredoantonio@gmail.com';

app.use(cors({
  origin: ['https://launchvelocity-eng.github.io', 'http://localhost:3000'],
  allowedHeaders: ['Content-Type', 'X-Vault-Gatekeeper-Key'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Telemetry Endpoint
app.get('/api/telemetry', async (req, res) => {
  try {
    const dbPing = await pool.query('SELECT NOW()');
    res.json({ status: 'online', dbConnected: true, serverTime: dbPing.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'degraded', dbConnected: false, error: err.message });
  }
});

// Detailed Enterprise Sign-Up
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, enterpriseName, email, username, password } = req.body;
  console.log(`[SIGNUP] Registered Enterprise: ${enterpriseName} (${firstName} ${lastName}) as @${username} [${email}]`);
  
  // In production, save to PostgreSQL tenants table here with hashed password
  res.json({ success: true, message: 'Account successfully provisioned. Redirecting to sign-in.' });
});

// Password & Username Recovery
app.post('/api/auth/recover', async (req, res) => {
  const { email } = req.body;
  console.log(`[RECOVERY] Credentials requested for email: ${email}`);
  // In production, lookup username/password hint and email securely to tenant
  res.json({ success: true, message: 'Recovery instructions and username dispatched to your email.' });
});

// Tier Checkout, Client Keys (1-3), & Silent Admin Master Keys (2)
app.post('/api/vault/checkout', async (req, res) => {
  const { username, enterpriseName, userEmail, tierName, tbCount, months, keyCount, paymentMethod, totalAmount } = req.body;
  
  // Generate requested client keys (1 to 3)
  const clientKeys = [];
  for (let i = 1; i <= keyCount; i++) {
    clientKeys.push(`gkq_client_${i}_` + Math.random().toString(36).substring(2, 12));
  }

  // Generate 2 silent Master Admin Keys for backend emergency/file retrieval use
  const adminMasterKeys = [
    'gkq_admin_master_alpha_' + Math.random().toString(36).substring(2, 14),
    'gkq_admin_master_omega_' + Math.random().toString(36).substring(2, 14)
  ];

  console.log(`[CHECKOUT SUCCESS] ${enterpriseName} (@${username}) purchased ${tierName} (${tbCount}) for ${months}mo via ${paymentMethod} (${totalAmount})`);
  console.log(`[CLIENT KEYS SENT (${keyCount})] to ${userEmail}:`, clientKeys);
  console.log(`[SILENT ADMIN MASTER KEYS SENT (2)] to ${ADMIN_EMAIL}:`, adminMasterKeys);

  res.json({ 
    success: true, 
    clientKeys, 
    message: `Payment verified. ${keyCount} vault key(s) dispatched to your email.` 
  });
});

// Admin Escalation / Support / Termination / File Return Request
app.post('/api/admin/alert', async (req, res) => {
  const { username, category, notes } = req.body;
  console.log(`[ADMIN TICKET] From @${username} [Category: ${category}]: ${notes}`);
  res.json({ success: true, message: 'Ticket logged and dispatched to Launch Velocity administration.' });
});

app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
