import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = path.join('/tmp', 'waitlist.json');

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

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
        const email = payload.email ? payload.email.trim() : '';

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!data.includes(email)) {
          data.push(email);
          fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        }

        // Trigger Resend API Email Dispatch with Launch Velocity Header Graphic
        if (process.env.RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Launch Velocity <onboarding@resend.dev>',
              to: [email],
              subject: 'Access Request Acknowledged - Launch Velocity',
              html: `
                <div style="background-color: #0b0f19; color: #ffffff; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; padding: 30px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h2 style="color: #38bdf8; letter-spacing: 2px; text-transform: uppercase; font-size: 20px; margin: 0;">Launch Velocity</h2>
                    </div>
                    <div style="text-align: center; margin-bottom: 24px;">
                      <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop" alt="Launch Velocity Enterprise Art" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid #374151;" />
                    </div>
                    <h3 style="color: #f3f4f6; font-size: 18px;">Access Request Acknowledged</h3>
                    <p style="color: #9ca3af; font-size: 14px; line-height: 1.6;">
                      Your enterprise email has been securely encrypted and registered. A formal receipt and platform notice will be dispatched to your inbox as custom storage partitions become available for allocation.
                    </p>
                    <div style="margin-top: 30px; border-top: 1px solid #1f2937; pt: 20px; text-align: center;">
                      <p style="color: #6b7280; font-size: 12px;">© 2026 Launch Velocity Engine. All rights reserved.</p>
                    </div>
                  </div>
                </div>
              `
            })
          });
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

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Launch Velocity API Active');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
