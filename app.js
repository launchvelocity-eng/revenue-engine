// Strict CORS & Security Headers
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
