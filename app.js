import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

// Connect to Render PostgreSQL database instance via DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Auto-initialize enterprise database tables on startup
async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL supplied. Skipping PostgreSQL initialization.');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS enterprise_tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255) NOT NULL,
        corporate_email VARCHAR(255) UNIQUE NOT NULL,
        tenant_key_id VARCHAR(64) UNIQUE NOT NULL,
        hsm_key_hash VARCHAR(256) NOT NULL,
        allocated_tb INTEGER NOT NULL DEFAULT 50,
        contract_months INTEGER NOT NULL DEFAULT 12,
        isolation_level VARCHAR(50) DEFAULT 'ZERO_TRUST_AIR_GAPPED',
        status VARCHAR(50) DEFAULT 'PROVISIONED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Enterprise PostgreSQL schema verified.');
  } catch (err) {
    console.error('PostgreSQL Schema Init Error:', err.message);
  } finally {
    client.release();
  }
}

initDb();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.
