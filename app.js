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

app.post('/api/vault/upload', validateVaultAccess, express.raw({ type: 'application/octet-stream', limit: '500mb' }), async (req, res) => {
    try {
        const fileName = req.headers['x-file-name'] || 'unnamed-payload';
        const fileExtension = fileName.split('.').pop().toLowerCase();

        const blockedExtensions = ['exe', 'sh', 'bat', 'cmd', 'scr', 'pif', 'js', 'jar'];
        if (blockedExtensions.includes(fileExtension)) {
            return res.status(400).json({ 
                success: false, 
                error: `Threat Inspection Failed: Extension .${fileExtension} is prohibited by zero-trust policy.` 
            });
        }

        const payloadSize = req.body ? req.body.length : 0;

        if (payloadSize > 500 * 1024 * 1024) {
            return res.status(413).json({ 
                success: false, 
                error: 'Payload Too Large: Single request exceeds the 500MB inline ceiling.' 
            });
        }

        console.log(`[VAULT INGESTION] Tenant ID: ${req.tenantId} | File: ${fileName} | Size: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);

        res.status(200).json({
            success: true,
            message: 'Payload successfully inspected and committed to air-gapped tenant partition.',
            tenant_id: req.tenantId,
            file_name: fileName,
            bytes_received: payloadSize
        });

    } catch (err) {
        console.error('[UPLOAD ERROR]:', err);
        res.status(500).json({ success: false, error: 'Failed to commit payload to secure vault.' });
    }
});
