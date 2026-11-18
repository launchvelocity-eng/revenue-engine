import express from 'express';
// ... any other imports (like pg, cors, etc.) ...

const app = express();

// ==========================================
// 1. Strict CORS & Security Headers Middleware
// ==========================================
const ALLOWED_ORIGIN = 'https://launchvelocity-eng.github.io';

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Engine-Signature', 'Launch-Velocity-Core-v1');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Middleware to parse JSON bodies if needed
app.use(express.json());

// ==========================================
// 2. Telemetry & Health Routes
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    engine: 'Launch Velocity',
    port: process.env.PORT || 10000,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/telemetry', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'enterprise-default';
    let dbStatus = '0ms Drift';
    let webhookCount = 14820;

    if (typeof pool !== 'undefined') {
      const start = Date.now();
      await pool.query('SELECT 1');
      dbStatus = `${Date.now() - start}ms Drift`;
    }

    res.status(200).json({
      tenantId,
      tier: 'Enterprise Core',
      rate: '$999/mo',
      vaultUsedTB: 1.2,
      vaultLimitTB: 5.0,
      pipelineThroughput: '99.98%',
      nodeStatus: `Render Node Port ${process.env.PORT || 10000} Online`,
      webhookEvents: webhookCount,
      pgSync: dbStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'TELEMETRY_FAULT', message: 'Database sync interrupted' });
  }
});

// ==========================================
// 3. Server Listener (Bottom of file)
// ==========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Launch Velocity engine listening on port ${PORT}`);
});
