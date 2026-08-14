// Fetch all encrypted assets for the authenticated user
app.get('/api/secure-assets', authenticateToken, async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });

    const result = await pool.query(
      'SELECT id, encrypted_data, created_at FROM user_assets WHERE email = $1 ORDER BY created_at DESC',
      [req.user.email]
    );

    res.json({
      success: true,
      assets: result.rows.map(row => ({
        id: row.id,
        payload: JSON.parse(row.encrypted_data),
        createdAt: row.created_at
      }))
    });
  } catch (err) {
    console.error('Error fetching secure assets:', err);
    res.status(500).json({ error: 'Failed to retrieve secure assets.' });
  }
});
