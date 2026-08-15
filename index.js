import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).send('Cloud Storage Database Engine is live.');
});

// Store data / waitlist endpoint
app.post('/api/waitlist', async (req, res) => {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email address is required.' });
    }

    try {
        await pool.query(
            'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
            [email.trim().toLowerCase()]
        );
        return res.status(200).json({ message: 'Successfully stored in database!' });
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

async function startServer() {
    try {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });

        await pool.query(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database table verified successfully.");
    } catch (err) {
        console.error('Startup error:', err);
    }
}

startServer();
