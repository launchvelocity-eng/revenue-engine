import http from 'node:http';
import pkg from 'pg';

const { Client } = pkg;

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
    // Enable CORS for frontend GitHub Pages request
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
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
            let client;
            try {
                const parsed = JSON.parse(body || '{}');
                const client_event = parsed.client_event || 'waitlist_signup';
                const email = parsed.payload?.asset_id || parsed.email;

                if (!email) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Email address is required' }));
                }

                client = new Client({
                    connectionString: process.env.DATABASE_URL,
                    ssl: { rejectUnauthorized: false }
                });

                await client.connect();

                // Auto-create waitlist table
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
                    [email, client_event]
                );

                await client.end();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, message: 'Waitlist entry recorded successfully!' }));

            } catch (err) {
                console.error('❌ Execution Error:', err.message);
                if (client) {
                    try { await client.end(); } catch (e) {}
                }
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // 404 Fallback
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
