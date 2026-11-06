import http from 'node:http';
import pg from 'pg';

const { Client } = pg;

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
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      try {
        const { email } = JSON.parse(body || '{}');

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        await client.connect();

        // Create table if it doesn't exist yet
        await client.query(`
          CREATE TABLE IF NOT EXISTS waitlist (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Insert new waitlist email
        await client.query(
          'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
          [email]
        );

        await client.end();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('SERVER EXECUTION ERROR:', err.message);
        try { await client.end(); } catch (e) {}
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Launch Velocity API Operational');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
