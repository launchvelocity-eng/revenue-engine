// Route: Create user vault after successful verification
app.post('/api/create-vault', async (req, res) => {
    const { email } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Create or retrieve the user
        const userRes = await client.query(
            'INSERT INTO secure_users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id',
            [email.toLowerCase()]
        );
        const userId = userRes.rows[0].id;

        // 2. Provision the storage vault with a placeholder key fingerprint
        await client.query(
            'INSERT INTO client_storage_vaults (user_id, encryption_key_fingerprint) VALUES ($1, $2)',
            [userId, 'AES256-GEN-SUCCESS-001']
        );

        await client.query('COMMIT'); // Finalize both
        res.json({ success: true, userId: userId });
        
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback if anything fails
        console.error('Vault Creation Error:', error);
        res.status(500).json({ error: 'Failed to provision secure vault.' });
    } finally {
        client.release(); // Free connection
    }
});
