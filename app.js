import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DB_FILE = path.join('/tmp', 'waitlist.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

const VAULT_TIERS = {
  standard: { name: 'Standard Enterprise Vault', capacity: '50 TB Partitioned' },
  advanced: { name: 'Advanced Isolated Vault', capacity: '250 TB Dedicated VPC' },
  quantum: { name: 'Quantum Air-Gapped Vault', capacity: '1 PB Dedicated HSM' }
};

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

        if (!email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid corporate email required.' }));
        }

        const tier = VAULT_TIERS[tierKey] || VAULT_TIERS.standard;
        const tenantKeyId = `LV-
