import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DB_FILE = path.join('/tmp', 'waitlist.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

const VAULT_TIERS = {
  standard: { name: 'Standard Enterprise Vault', capacity: '50 TB Partitioned', monthlyBase: 3500, insurance: '$5M Cyber Guarantee' },
  advanced: { name: 'Advanced Isolated Vault', capacity: '250 TB Dedicated VPC', monthlyBase: 9800, insurance: '$10M Cyber Guarantee' },
  quantum: { name: 'Quantum Air-Gapped Vault', capacity: '1 PB Dedicated HSM', monthlyBase: 25000, insurance: '$25M Cyber Guarantee + Defense' }
};

const DISCOUNTS = { '1m': 0, '3m': 0.05, '6m': 0.10, '1y': 0.15, '2y': 0.25 };

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
        const tierKey = payload.tier || 'standard';
        const termKey = payload.term || '1y';

        if (!email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        const tier = VAULT_TIERS[tierKey] || VAULT_TIERS.standard;
        const discount = DISCOUNTS[termKey] || 0;
        const effectiveMonthly = tier.monthlyBase * (1 - discount);
        const tenantKeyId = `LV-KEY-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

        const entry = { email, tier: tier.name, capacity: tier.capacity, term: termKey, monthlyRate: `$${effectiveMonthly}/mo`, tenantKeyId, date: new Date().toISOString() };

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
                subject: `Vault Provisioning Acknowledged - ${tier.name}`,
                html: `
                  <div style="background:#0b0f19;color:#fff;padding:30px;font-family:sans-serif;">
                    <h2 style="color:#38bdf8;">LAUNCH VELOCITY</h2>
                    <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;" />
                    <h3>Enterprise Vault Reserved</h3>
                    <p><strong>Tier:</strong> ${tier.name} (${tier.capacity})</p>
                    <p><strong>Rate:</strong> ${entry.monthlyRate}</p>
                    <p><strong>Tenant Key ID:</strong> <code>${tenantKeyId}</code></p>
                    <p><strong>Insurance:</strong> ${tier.insurance}</p>
                  </div>
                `
              })
            });
          } catch (mailErr) {
            console.error('Resend dispatch failed gracefully:', mailErr.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, tenantKeyId }));
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
