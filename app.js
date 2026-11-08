// ==========================================
// AUTOMATED ENTERPRISE DATABASE MIGRATION LAYER
// ==========================================
async function runDatabaseMigrations() {
  console.log('[MIGRATION ENGINE] Checking enterprise relational table schemas...');
  const client = await pool.connect();
  
  try {
    // Transactional block ensuring all zero-trust data layouts exist
    await client.query('BEGIN;');

    // 1. Structural table for lease configurations
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_leases (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        partition_name VARCHAR(255) NOT NULL,
        lease_status VARCHAR(50) DEFAULT 'GRACE_PERIOD',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        finalized_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // 2. Master router parent table for corporate partition slices
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_data_partitions (
        id SERIAL,
        tenant_id VARCHAR(255) NOT NULL,
        data JSONB,
        PRIMARY KEY (id, tenant_id)
      );
    `);

    await client.query('COMMIT;');
    console.log('[MIGRATION ENGINE] Database schema verified: All systems green.');
  } catch (migrationErr) {
    await client.query('ROLLBACK;');
    console.error('[CRITICAL MIGRATION FAILURE] Automatic initialization failed:', migrationErr.message);
  } finally {
    client.release();
  }
}
