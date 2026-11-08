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
