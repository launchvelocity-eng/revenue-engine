import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool using Render SSL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Auto-create waitlist table on app boot
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                client_event VARCHAR(100) DEFAULT 'waitlist_signup',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Waitlist table ready');
    } catch (err) {
        console.error('⚠️ DB Init Error:', err.message);
    }
};
initDb();

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Revenue-Engine API is running successfully' });
});

// Waitlist Submission Endpoint
app.post('/api/execute', async (req, res) => {
    try {
        const { client_event, payload } = req.body;
        const email = payload?.asset_id || req.body.email;

        if (!email) {
            return res.status(400).json({ error: 'Email address is required' });
        }

        // Insert email into PostgreSQL database
        await pool.query(
            'INSERT INTO waitlist (email, client_event) VALUES ($1, $2)',
            [email, client_event || 'waitlist_signup']
        );

        return res.status(200).json({ success: true, message: 'Signed up successfully!' });
    } catch (err) {
        console.error('❌ Waitlist execution error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
