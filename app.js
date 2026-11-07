import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DB_FILE = path.join('/tmp', 'waitlist.json');

// Initialize local JSON database fallback
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// Vault Tier Mapping & Pricing Schedule ($5M+ Insured Base)
const VAULT_TIERS = {
  standard: {
    name: 'Standard Enterprise Vault',
    capacity: '50 TB Partitioned',
    monthlyBase: 3500,
    insurance: '$5 Million Cyber Loss Guarantee'
  },
  advanced: {
    name: 'Advanced Isolated Vault',
    capacity: '250 TB Dedicated VPC',
    monthlyBase: 9800,
    insurance: '$10 Million Cyber Loss Guarantee'
  },
  quantum: {
    name: 'Quantum Air-Gapped Vault',
    capacity: '1 PB Dedicated HSM',
    monthlyBase: 25000,
    insurance: '$25 Million Cyber Loss Guarantee + Legal Defense'
  }
};

const DISCOUNTS = {
  '1m': 0.0,
  '3m': 0.05,
  '6m': 0.10,
  '1y': 0.15,
  '2y': 0.25
};

const server = http.createServer((req, res) => {
  // Enforce CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Enterprise Vault Reservation Endpoint
  if (req.method === 'POST' && req.url === '/api/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = payload.email ? payload.email.trim() : '';
        const tierKey = payload.tier || 'standard';
        const termKey = payload.term || '1y';

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        const tierConfig = VAULT_TIERS[tierKey] || VAULT_TIERS.standard;
        const discount = DISCOUNTS[termKey] || 0.0;
        const effectiveMonthly = tierConfig.monthlyBase * (1 - discount);

        // Generate Dedicated Enterprise Security Key (FIPS 140-2 Compliant Format)
        const tenantKeyId = `LV-KEY-${crypto.randomBytes(8).toString('hex').toUpperCase()}`; const timestamp = new Date().toISOString();  const entry = { email, tier: tierConfig.name, capacity: tierConfig.capacity, term: termKey, monthlyRate: `$${effectiveMonthly.toLocaleString()}/mo`, insurance: tierConfig.insurance, tenantKeyId, registeredAt: timestamp };  // Persist Entry const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); data.push(entry); fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));  // Trigger Resend API Email Dispatch if (process.env.RESEND_API_KEY) { await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Launch Velocity <onboarding@resend.dev>',
              to: [email],
              subject: `Vault Provisioning Acknowledged - ${tierConfig.name}`,
              html: `
                <div style="background-color: #0b0f19; color: #ffffff; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <div style="max-width: 650px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; padding: 32px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h2 style="color: #38bdf8; letter-spacing: 2px; text-transform: uppercase; font-size: 22px; margin: 0;">LAUNCH VELOCITY</h2>
                      <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">Insured Enterprise Cloud Storage</p>
                    </div>
                    
                    <div style="text-align: center; margin-bottom: 24px;">
                      <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop" alt="Launch Velocity Enterprise Asset" style="width: 100%; max-height: 220px; object-fit: cover; border-radius:
