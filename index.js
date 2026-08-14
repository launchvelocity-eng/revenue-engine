import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function startServer() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database pool initialized and all session tables verified.");

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

        const PORT = process.env.PORT || 10000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Critical startup error:', err);
        process.exit(1);
    }
}

startServer();
