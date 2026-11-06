import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Client } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Revenue-Engine API is running successfully' });
});

// Sync Endpoint for Front-End Waitlist Submissions
app.post('/api/execute', async (req, res) => {
    const { client_event, payload } = req.body;
    const email = payload?.asset_id || req.body.email;

    if (!email) {
        return res.status(400).json({ error: 'Email address is required' });
    }

    // Direct per-request PostgreSQL client connection
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. SQL: Auto-initialize table schema if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                client_event VARCHAR(100) DEFAULT 'waitlist_signup',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. SQL: Execute insert query
        await client.query(
            'INSERT INTO waitlist (email, client_event) VALUES ($1, $2)',
            [email, client_event || 'waitlist_signup']
        );

        await client.end();
        return res.status(200).json({ success: true, message: 'Waitlist entry recorded successfully!' });

    } catch (err) {
        console.error('❌ SQL Execution Error:', err.message);
        try { await client.end(); } catch (e) {}
        
