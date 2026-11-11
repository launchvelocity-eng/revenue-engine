// Secure Vault Upload Endpoint with Gatekeeper Check
app.post('/api/vault/upload', async (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'];

  if (!gatekeeperKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing Gatekeeper Key header.' });
  }

  try {
    // 1. Verify tenant authorization
    const authCheck = await pool.query(
      'SELECT id, tenant_name, tier FROM tenant_vaults WHERE vault_key = $1 LIMIT 1',
      [gatekeeperKey]
    );

    if (authCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Forbidden: Invalid or expired Gatekeeper Key.' });
    }

    const tenant = authCheck.rows[0];

    // 2. Process payload upload for this tenant...
    console.log(`[VAULT UPLOAD] Received secure payload for tenant: ${tenant.tenant_name} (${tenant.tier})`);

    res.json({
      success: true,
      tenant: tenant.tenant_name,
      message: 'Payload successfully ingested and locked into vault storage.'
    });

  } catch (err) {
    console.error('[UPLOAD ERROR]', err.message);
    res.status(500).json({ error: 'Internal server upload processing error.' });
  }
});
