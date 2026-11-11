// Gatekeeper Middleware / Validation Route
app.post('/api/auth/validate', async (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'] || req.body?.gatekeeperKey;

  if (!gatekeeperKey) {
    return res.status(401).json({
      authenticated: false,
      error: 'Missing X-Vault-Gatekeeper-Key header.'
    });
  }

  try {
    // Validate key against active tenant records in PostgreSQL
    const result = await pool.query(
      'SELECT id, tenant_name, tier FROM tenant_vaults WHERE vault_key = $1 LIMIT 1',
      [gatekeeperKey]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        authenticated: false,
        error: 'Invalid or expired Gatekeeper Key.'
      });
    }

    const tenant = result.rows[0];
    res.json({
      authenticated: true,
      tenantName: tenant.tenant_name,
      tier: tenant.tier,
      message: 'Gatekeeper authentication successful.'
    });
  } catch (err) {
    console.error('[GATEKEEPER ERROR] Validation failed:', err.message);
    res.status(500).json({ authenticated: false, error: 'Internal server validation error.' });
  }
});
