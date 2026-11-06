import http from 'node:http';
import pg from 'pg';

const { Pool } = pg;

// Connection config for Render PostgreSQL (External URL compatible)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('PostgreSQL Pool Error:', err.message);
});

const server = http.createServer(async (req, res) => {
  // CORS Headers for GitHub Pages frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let client;
      try {
        const data = JSON.parse(body || '{}');
        const email = data.email;

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        client = await pool.connect();

        // On-demand table creation
        await client.query(`
          CREATE TABLE IF NOT EXISTS waitlist (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Insert email entry
        await client.query(
          'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
          [email]
        );

        client.release();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'Priority access requested.' }));
      } catch (err) {
        console.error('Execution Error Detail:', err.message);
        if (client) client.release();
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Internal Server Error' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Launch Velocity API Operational');
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
