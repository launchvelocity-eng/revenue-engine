// Waitlist Endpoint
app.post('/api/waitlist', async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email address is required.' });
    }

    try {
        await pool.query(
            'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
            [email]
        );
        return res.status(200).json({ message: 'Successfully joined the waitlist!' });
    } catch (err) {
        console.error('Waitlist error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});
