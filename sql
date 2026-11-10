-- Example fix in your worker SQL query:
UPDATE tenant_vaults SET "status" = 'archived' WHERE expires_at < NOW();
