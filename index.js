// Admin Waitlist Viewer Endpoint
app.get('/api/admin/waitlist', async (req, res) => {
    // Optional: Add simple token/auth check here if desired
    try {
        const result = await pool.query('SELECT email, created_at FROM waitlist ORDER BY created_at DESC');
        return res.status(200).json({ waitlist: result.rows });
    } catch (err) {
        console.error('Fetch waitlist error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});
