import http from 'node:http';
import pkg from 'pg';

const { Pool } = pkg;

// Initialize PostgreSQL Pool with Render SSL and keep-alive settings
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
    // Enable CORS for GitHub Pages frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Health check endpoint
    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'Revenue-Engine API is running successfully' }));
    }

    // Waitlist Submission Endpoint
    if (req.url === '/api/execute' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const client_event = parsed.client_event || 'waitlist_signup';
                const email = parsed.payload?.asset_id || parsed.email;

                if (!email) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Email address is required' }));
                }

                // 1. Ensure table exists using pool
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS waitlist (
                        id SERIAL PRIMARY KEY,
                        email VARCHAR(255) NOT NULL,
                        client_event VARCHAR(100) DEFAULT 'waitlist_signup',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // 2. Insert record safely
                await pool.query(
                    'INSERT INTO waitlist (email, client_event) VALUES ($1, $2)',
                    [email, client_event]
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, message: 'Waitlist entry recorded successfully!' }));

            } catch (err) {
                console.error('❌ Database Execution Error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
