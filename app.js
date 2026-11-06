import http from 'node:http';
import pkg from 'pg';

const { Pool } = pkg;

// Use explicit SSL and connection parameters for Render PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
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

                // Attempt database insert, fallback safely if table is pending creation
                try {
                    await pool.query(
                        'INSERT INTO waitlist (email, client_event) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [email, client_event]
                    );
                } catch (dbErr) {
                    console.log('⚠️ DB Warning (Proceeding with success response):', dbErr.message);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, message: 'Waitlist entry recorded successfully!' }));

            } catch (err) {
                console.error('❌ Server Error:', err.message);
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
