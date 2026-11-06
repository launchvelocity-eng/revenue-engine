import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();

// Enable CORS for all origins (allows GitHub Pages to talk to Render)
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('⚠️ Database connection warning:', err.message);
    } else {
        console.log('📦 Connected to PostgreSQL database successfully!');
        release();
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Revenue-Engine API is running successfully' });
});

// Waitlist Submission Endpoint
app.post('/api/execute', async (req, res) => {
    const { client_event, payload } = req.body;
    const email = payload?.asset_id;

    if (!email) {
        return res.status(400).json({ error: 'Email address is required' });
    }

    try {
        // Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                client_event VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert signup
        await pool.query(
            'INSERT INTO waitlist (email, client_event) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
            [email, client_event || 'waitlist_signup']
        );

        res.status(200).json({ success: true, message: 'Signed up successfully!' });
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: 'Database execution failed' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
