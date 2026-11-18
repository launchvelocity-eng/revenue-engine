-- Core users and client organizations
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    tier VARCHAR(50) DEFAULT 'starter', -- starter, growth, enterprise
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zero-trust encrypted vault metadata tracking
CREATE TABLE IF NOT EXISTS vault_assets (
    id SERIAL PRIMARY KEY,
    tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stripe billing & webhook ledger
CREATE TABLE IF NOT EXISTS billing_events (
    id SERIAL PRIMARY KEY,
    tenant_id INT REFERENCES tenants(id),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    amount_paid INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
