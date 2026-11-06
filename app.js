import http from 'node:http';
import pg from 'pg';

const { Pool } = pg;

// Construct database pool with explicit Render SSL parameters
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('sslmode=')) {
  dbUrl += dbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

// Resilient initialization with connection retry logic
async function initDb(retries = 3) {
  while (retries > 0) {
    try {
      const client = await pool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS waitlist (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      client.release();
      console.log('Database initialized successfully: waitlist table ready.');
      return;
    } catch (err) {
      console.error(`Database connection attempt failed (${retries} retries left):`, err.message);
      retries -= 1;
      if (retries === 0) break;
      await new Promise(res => setTimeout(res, 3000));
    }
  }
}

initDb();

const server = http.createServer(async (req, res) => {
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
      try {
        const data = JSON.parse(body || '{}');
        const email = data.email;

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        const client = await pool.connect();
        await client.query(
          'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
          [email]
        );
        client.release();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'Priority access requested.' }));
      } catch (err) {
        console.error('Execution Error:', err.message);
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
