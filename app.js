// Verify whether an email is an active, paid customer
app.get('/api/subscription-status', async (req, res) => {
  const email = String(req.query?.email || '').trim().toLowerCase();
  if (!email || !pool) return res.json({ registered: false });

  try {
    const result = await pool.query(
      'SELECT tier, created_at FROM customers WHERE email = $1 LIMIT 1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.json({ registered: false });
    }
    res.json({ registered: true, tier: result.rows[0].tier, activatedAt: result.rows[0].created_at });
  } catch (err) {
    res.status(500).json({ registered: false, error: err.message });
  }
});
