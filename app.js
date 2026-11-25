app.post('/api/v1/create-checkout-session', verifyHardwareKey, async (req, res) => {
  const tier = req.body?.tier || 'retained';
  const tenantId = req.header('x-tenant-id') || 'enterprise-default';

  const tierMap = {
    starter: { price: 19900, storage: '0.5 TB' },
    growth: { price: 49900, storage: '2.0 TB' },
    enterprise: { price: 99900, storage: '5.0 TB' },
    retained: { price: 250000, storage: '10.0 TB' },
  };

  const selectedTier = tierMap[tier] || tierMap.retained;

  try {
    if (pool) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS revenue_audit (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          tier TEXT NOT NULL,
          amount INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(
        'INSERT INTO revenue_audit (tenant_id, tier, amount, status) VALUES ($1, $2, $3, $4)',
        [tenantId, tier, selectedTier.price, 'PENDING_SETTLEMENT']
      );
    }

    return res.status(200).json({
      url: `https://checkout.stripe.com/pay/lv-session-${Date.now()}`,
      status: 'AUTHORIZED',
      tier,
      allocatedVault: selectedTier.storage,
    });
  } catch (err) {
    console.error('Settlement initialization failed:', err);
    return res.status(500).json({ error: err.message || 'Database pipeline sync failure' });
  }
});
