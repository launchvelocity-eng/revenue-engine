-- Enable UUID extension for cryptographic tenant identification
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enterprise Tenants Table
CREATE TABLE IF NOT EXISTS enterprise_tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    corporate_email VARCHAR(255) UNIQUE NOT NULL,
    tenant_key_id VARCHAR(64) UNIQUE NOT NULL,
    hsm_key_hash VARCHAR(256) NOT NULL,
    isolation_level VARCHAR(50) DEFAULT 'ZERO_TRUST_AIR_GAPPED',
    status VARCHAR(50) DEFAULT 'PROVISIONING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vault Storage Partitions Table (Enforces Exact TB Limits & Contract Terms)
CREATE TABLE IF NOT EXISTS vault_partitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES enterprise_tenants(id) ON DELETE CASCADE,
    allocated_tb INTEGER NOT NULL CHECK (allocated_tb > 0),
    contract_months INTEGER NOT NULL CHECK (contract_months IN (1, 3, 6, 12, 24)),
    storage_path VARCHAR(512) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    provisioned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for instant key authentication lookups
CREATE INDEX IF NOT EXISTS idx_tenant_key ON enterprise_tenants(tenant_key_id);
