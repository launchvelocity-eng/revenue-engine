const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join('/tmp', 'waitlist.json');

// Initialize local fallback storage
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

const server = http.createServer((req, res) => {
  // Enforce CORS for full access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Execution API endpoint
  if (req.method === 'POST' && req.url === '/api/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = (payload.email || '').trim();

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid email address required.' }));
        }

        const tenantKeyId = `LV-KEY-${crypto.randomBytes(6).toString('hex').toUpperCase()}`; const entry = { email, tenantKeyId, registeredAt: new Date().toISOString() };  // Persist locally try { const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); data.push(entry); fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); } catch (dbErr) { console.error('Storage write error:', dbErr.message); }  // Optional Resend email dispatch if key present if (process.env.RESEND_API_KEY) { try { await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Launch Velocity <onboarding@resend.dev>',
                to: [email],
                subject: 'Launch Velocity Registration',
                html: `<div style="font-family:sans-serif;padding:20px;">
