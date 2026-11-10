CREATE TABLE IF NOT EXISTS tenant_vaults (
  id SERIAL PRIMARY KEY,
  tenant_name VARCHAR(255) NOT NULL,
  vault_key VARCHAR(255) UNIQUE NOT NULL,
  tier VARCHAR(50) DEFAULT 'standard',
  storage_used_bytes BIGINT DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
