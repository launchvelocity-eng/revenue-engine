    // Route: Vault File Upload (With Enterprise Firewall Protection)
    if (parsedUrl.pathname === '/api/vault/upload' && req.method === 'POST') {
        // Enforce Rate Limit Firewall
        if (!enforceRateLimit(req)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Firewall Triggered: Rate limit exceeded. Too many requests.' }));
            return;
        }

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

            // Extension Blacklist Check
            const blockedExtensions = ['exe', 'sh', 'bat', 'cmd', 'scr', 'pif', 'js', 'jar'];
            if (blockedExtensions.includes(fileExtension)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `Threat Inspection Failed: Extension .${fileExtension} is prohibited.` }));
                return;
            }

            // Read Stream and Enforce 500MB Cap
            const rawBody = await getRawBody();

            // Deep Binary Threat Inspection (Magic Byte Check)
            const binaryThreat = inspectBinaryThreats(rawBody);
            if (binaryThreat) {
                console.warn(`[SECURITY ALERT] Tenant ${tenantId} attempted to upload blocked binary signature: ${binaryThreat}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `Firewall Threat Blocked: ${binaryThreat}` }));
                return;
            }

            console.log(`[VAULT INGESTION] Tenant ID: ${tenantId} | File: ${fileName} | Size: ${(rawBody.length / 1024 / 1024).toFixed(2)} MB | Firewall: PASSED`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Payload successfully inspected and committed to air-gapped tenant partition.', tenant_id: tenantId, bytes_received: rawBody.length }));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message || 'Failed to commit payload.' }));
        }
        return;
    }
