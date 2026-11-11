INSERT INTO tenant_vaults (tenant_name, vault_key, tier, storage_used_bytes)
VALUES ('Apex Global Corp', 'gkq_live_99f28a38b10', 'enterprise', 104857600)
ON CONFLICT (vault_key) DO NOTHING;
