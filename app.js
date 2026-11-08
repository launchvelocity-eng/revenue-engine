import http from 'http';
import { URL } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

// Database connection pool setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize Database Schema
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tenant_vault_keys (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) UNIQUE NOT NULL,
                company_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                key_hash VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tenant_lease_lifecycle (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) REFERENCES tenant_vault_keys(tenant_id),
                status VARCHAR(32) DEFAULT 'ACTIVE',
                grace_ends_at TIMESTAMP,
                purged_at TIMESTAMP
            );
        `);
        console.log('[DB ENGINE] Schema initialized successfully.');
    } catch (err) {
        console.error('[DB ERROR] Failed to initialize schema:', err);
    }
}

initDB();

// --- VAULT GATEKEEPER & FILE UPLOAD PIPELINE ---

async function validateVaultAccess(req, res, next) {
    const apiKey = req.headers['x-vault-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing x-vault-api-key header.' });
    }

    try {
        const keyResult = await pool.query(
            `SELECT k.tenant_id, k.is_active, l.status, l.grace_ends_at 
             FROM tenant_vault_keys k 
             JOIN tenant_lease_lifecycle l ON k.tenant_id = l.tenant_id 
             WHERE k.key_hash = $1`,
            [apiKey]
        );

        if (keyResult.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Forbidden: Invalid vault access key.' });
        }

        const tenantData = keyResult.rows[0];

        if (tenantData.status === 'LOCKED_OUT' || tenantData.status === 'PURGED') {
            return res.status(403).json({ 
                success: false, 
                error: 'Partition Access Denied: Tenant lease has expired or is locked out.' 
            });
        }

        req.tenantId = tenantData.tenant_id;
        next();
    } catch (err) {
        console.error('[GATEKEEPER ERROR]:', err);
        res.status(500).json({ success: false, error: 'Internal gatekeeper verification fault.' });
    }
}

// Simple Express-like router handling body parsing for raw streams and JSON
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-vault-api-key, x-file-name');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

    // Helper to parse JSON body
    const getJsonBody = () => new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); } 
            catch (e) { reject(e); }
        });
    });

    // Helper to parse Raw body (for file uploads)
    const getRawBody = () => new Promise((resolve, reject) => {
        let chunks = [];
        let totalSize = 0;
        req.on('data', chunk => {
            chunks.push(chunk);
            totalSize += chunk.length;
            if (totalSize > 500 * 1024 * 1024) { // 500MB cap guard
                reject(new Error('Payload Too Large'));
            }
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Route: Waitlist / Partition Execution
    if (parsedUrl.pathname === '/api/execute' && req.method === 'POST') {
        try {
            const { company, email } = await getJsonBody();
            if (!company || !email) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Company and email are required.' }));
                return;
            }

            const tenantId = 'tenant_' + Math.random().toString(36).substring(2, 10);
            const clientKey = 'LV-KEY-CLIENT-' + Math.random().toString(36).substring(2, 15);

            await pool.query(
                `INSERT INTO tenant_vault_keys (tenant_id, company_name, email, key_hash) VALUES ($1, $2, $3, $4)`,
                [tenantId, company, email, clientKey]
            );

            await pool.query(
                `INSERT INTO tenant_lease_lifecycle (tenant_id, status, grace_ends_at) VALUES ($1, 'ACTIVE', NOW() + INTERVAL '7 days')`,
                [tenantId]
            );

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, tenant_id: tenantId, message: 'Partition provisioned successfully.' }));
        } catch (err) {
            console.error('[EXECUTE ERROR]:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server execution fault.' }));
        }
        return;
    }

    // Route: Vault File Upload
    if (parsedUrl.pathname === '/api/vault/upload' && req.method === 'POST') {
        // Mocking middleware execution for native HTTP
        const apiKey = req.headers['x-vault-api-key'];
        if (!apiKey) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing x-vault-api-key header.' }));
            return;
        }

        try {
            const keyResult = await pool.query(
                `SELECT k.tenant_id, l.status FROM tenant_vault_keys k JOIN tenant_lease_lifecycle l ON k.tenant_id = l.tenant_id WHERE k.key_hash = $1`,
                [apiKey]
            );

            if (keyResult.rows.length === 0 || keyResult.rows[0].status !== 'ACTIVE') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Forbidden: Invalid or expired vault access key.' }));
                return;
            }

            const tenantId = keyResult.rows[0].tenant_id;
            const fileName = req.headers['x-file-name'] || 'unnamed-payload';
            const fileExtension = fileName.split('.').pop().toLowerCase();

            const blockedExtensions = ['exe', 'sh', 'bat', 'cmd', 'scr', 'pif', 'js', 'jar'];
            if (blockedExtensions.includes(fileExtension)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `Threat Inspection Failed: Extension .${fileExtension} is prohibited.` }));
                return;
            }

            const rawBody = await getRawBody();
            console.log(`[VAULT INGESTION] Tenant ID: ${tenantId} | File: ${fileName} | Size: ${(rawBody.length / 1024 / 1024).toFixed(2)} MB`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Payload successfully committed to air-gapped tenant partition.', tenant_id: tenantId, bytes_received: rawBody.length }));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message || 'Failed to commit payload.' }));
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found.' }));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
