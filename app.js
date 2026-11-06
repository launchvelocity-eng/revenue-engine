import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Client } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Revenue-Engine API is running successfully' });
});

// Waitlist Submission Endpoint
app.post('/api/execute', async (req, res) => {
    let client;
    try {
        const { client_event, payload } = req.body || {};
        const email = payload?.asset_id || req.body?.email;

        if (!email) {
            return res.status(400).json({ error: 'Email address is required' });
        }

        client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await client.connect();

        // Ensure table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                client_event VARCHAR(100) DEFAULT 'waitlist_signup',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insert record safely
        await client.query(
            'INSERT INTO waitlist (email, client_event) VALUES ($1, $2)',
            [email, client_event || 'waitlist_signup']
        );

        await client.end();
        return res.status(200).json({ success: true, message: 'Waitlist entry recorded successfully!' });

    } catch (err) {
        console.error('❌ Execution Error:', err.message);
        if (client) {
            try { await client.end(); } catch (e) {}
        }
        return res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
