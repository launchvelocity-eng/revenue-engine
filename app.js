import http from 'node:http';
import pkg from 'pg';

const { Pool } = pkg;

// Render PostgreSQL Pool with strict SSL acceptance
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'Revenue-Engine API is running successfully' }));
    }

    if (req.url === '/api/execute' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const client_event = parsed.client_event || 'waitlist_signup';
                const email = parsed.payload?.asset_id || parsed.email;

                if (!email) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Email address is required' }));
                }

                // Insert directly (table assumed pre-initialized or handled)
                await pool.query(
                    'INSERT INTO waitlist (email, client_event) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [email, client_event]
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, message: 'Waitlist entry recorded successfully!' }));

            } catch (err)
