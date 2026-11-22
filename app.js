app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://launchvelocity-eng.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-hardware-key, x-tenant-id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});
