-- Core lease configuration table
CREATE TABLE IF NOT EXISTS tenant_leases (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    partition_name VARCHAR(255) NOT NULL,
    lease_status VARCHAR(50) DEFAULT 'GRACE_PERIOD',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finalized_at TIMESTAMP WITH TIME ZONE
);

-- Master router parent table for corporate partition slices
CREATE TABLE IF NOT EXISTS tenant_data_partitions (
    id SERIAL,
    tenant_id UUID NOT NULL,
    data JSONB,
    PRIMARY KEY (id, tenant_id)
) PARTITION BY LIST (tenant_id);
