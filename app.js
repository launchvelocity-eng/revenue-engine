import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = path.join('/tmp', 'waitlist.json');

// Initialize local JSON storage if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Handle Waitlist Form Submission
  if (req.method === 'POST' && req.url === '/api/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = payload.email ? payload.email.trim() : '';

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        // Read existing records
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

        // Save email if unique
        if (!data.includes(email)) {
          data.push(email);
          fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'Access requested.' }));
      } catch (err) {
        console.error('API Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Root Health Check
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Launch Velocity API Active (Local Engine)');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
