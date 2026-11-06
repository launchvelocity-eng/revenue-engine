import http from 'http';
import { Pool } from 'pg';

const PORT = process.env.PORT || 3000;

// Initialize PostgreSQL Pool with SSL required by Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Database Connection Diagnostics
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

// HTTP Server Handler
const server = http.createServer(async (req, res) => {
  // Enable CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle Preflight Requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Endpoint: Health Check
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'Revenue-Engine API' }));
    return;
  }

  // Endpoint: Execute / Waitlist Ingestion
  if (req.method === 'POST' && url.pathname === '/api/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const { email } = payload;

        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Email is required' }));
          return;
        }

        // Store Email in PostgreSQL Database
        const queryText = `
          INSERT INTO waitlist (email, created_at)
          VALUES ($1, NOW())
          ON CONFLICT (email) DO NOTHING
          RETURNING id;
        `;
        const result = await pool.query(queryText, [email]);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Successfully registered for waitlist',
          id: result.rows[0]?.id || null
        }));
      } catch (err) {
        console.error('API /api/execute execution error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message }));
      }
    });
    return;
  }

  // Catch-all 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
});

// Server Listener with Error Catching
server.listen(PORT, () => {
  console.log(`Revenue-Engine backend actively listening on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('Server failure on launch:', err.message);
});
