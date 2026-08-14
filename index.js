// Middleware to verify active subscription tier
async function requireActiveSubscription(req, res, next) {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });

    const result = await pool.query(
      'SELECT subscription_status, tier_name FROM users WHERE email = $1',
      [req.user.email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const user = result.rows[0];
    if (user.subscription_status !== 'active') {
      return res.status(403).json({ 
        error: 'Active subscription required to access this resource.',
        currentStatus: user.subscription_status 
      });
    }

    req.user.tierName = user.tier_name;
    next();
  } catch (err) {
    console.error('Subscription Check Error:', err);
    res.status(500).json({ error: 'Failed to verify subscription status.' });
  }
}

// Example of a Protected Premium Asset Storage Route
app.post('/api/secure-store', authenticateToken, requireActiveSubscription, async (req, res) => {
  const { encryptedPayload } = req.body;
  if (!encryptedPayload) {
    return res.status(400).json({ error: 'Encrypted payload is required.' });
  }

  try {
    await pool.query(
      'INSERT INTO user_assets (email, encrypted_data) VALUES ($1, $2)',
      [req.user.email, JSON.stringify(encryptedPayload)]
    );

    res.json({ success: true, message: 'Encrypted asset safely stored in vault.' });
  } catch (err) {
    console.error('Secure Store Error:', err);
    res.status(500).json({ error: 'Failed to store secure asset.' });
  }
});
