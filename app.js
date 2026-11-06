import http from 'node:http';
import pg from 'pg';

const { Pool } = pg;

// Helper to sanitize and normalize the database connection string
function getDbConfig() {
  let connectionString = process.env.DATABASE_URL || '';
  
  // Ensure SSL is properly configured for Render PostgreSQL instances
  const config = {
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, // 10 second timeout to prevent hanging
    idleTimeoutMillis: 30000
  };
  
  return config;
}

const pool = new Pool(getDbConfig());

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
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

  // API Endpoint: /api/execute
  if (req.method === 'POST' && req.url === '/api/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    
    req.on('end', async () => {
      let client;
      try {
        const payload = JSON.parse(body || '{}');
        const email = payload.email ? payload.email.trim() : '';

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        // Acquire connection from pool
        client = await pool.connect();

        // Create table schema if not already present
        await client.query(`
          CREATE TABLE IF NOT EXISTS waitlist (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Insert record safely with conflict handling
        await client.query(
          'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
          [email]
        );

        client.release();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'Capacity secured.' }));
      } catch (err) {
        console.error('EXECUTION FAILURE:', err.message);
        if (client) client.release();
        
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Default health check route
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Launch Velocity Enterprise API Operational');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Launch Velocity server active on port ${PORT}`);
});
