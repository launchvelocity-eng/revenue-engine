import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = path.join('/tmp', 'waitlist.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

const server = http.createServer((req, res) => {
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
        const payload = JSON.parse(body || '{}');
        const email = (payload.email || '').trim();

        if (!email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid email required.' }));
        }

        const entry = { email, date: new Date().toISOString() };

        try {
          const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
          data.push(entry);
          fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        } catch (e) {
          console.error('File DB write error:', e);
        }

        if (process.env.RESEND_API_KEY) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'Launch Velocity <onboarding@resend.dev>',
                to: [email],
                subject: 'Welcome to Launch Velocity',
                html: `
                  <div style="font-family:sans-serif;padding:20px;color:#111;">
                    <h2>Welcome to Launch Velocity</h2>
                    <p>Thank you for signing up. We have received your request and will keep you updated on our enterprise cloud storage launch.</p>
                    <p>Best regards,<br/><strong>The Launch Velocity Team</strong></p>
                  </div>
                `
              })
            });
          } catch (mailErr) {
            console.error('Resend dispatch failed gracefully:', mailErr.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('API Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Launch Velocity Engine Live');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
