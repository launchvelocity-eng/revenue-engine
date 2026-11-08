import pkg from 'pg';
const { Pool } = pkg;

// Initialize your production database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for secure cloud database hosting layers
});

/**
 * Executes a zero-trust multi-tenant offboarding lifecycle sweep.
 * Guarantees zero race conditions across concurrent workers using ROW-LOCKING and SKIP LOCKED.
 */
export async function executeTenantOffboardingAudit() {
  console.log('[LEASE WORKER] Initiating automated corporate lease expiration audit...');
  
  // Acquire an independent client from the pool to hold row locks across an explicit transaction
  const lockClient = await pool.connect();
  
  try {
    // -------------------------------------------------------------------------
    // TRANSACTION 1: Row Locking & State Isolation
    // -------------------------------------------------------------------------
    await lockClient.query('BEGIN;');

    // Identify up to 5 tenants whose 7-day grace periods have expired.
    // FOR UPDATE SKIP LOCKED guarantees that if Worker B runs concurrently, it skips these rows entirely.
    const targetingQuery = `
      SELECT id, tenant_id, partition_name 
      FROM tenant_leases 
      WHERE expires_at <= NOW() - INTERVAL '7 days' 
        AND lease_status = 'GRACE_PERIOD'
      LIMIT 5
      FOR UPDATE SKIP LOCKED;
    `;
    
    const { rows: expiredTenants } = await lockClient.query(targetingQuery);

    if (expiredTenants.length === 0) {
      console.log('[LEASE WORKER] Audit complete. Zero expired enterprise leases found.');
      await lockClient.query('COMMIT;');
      return;
    }

    console.log(`[LEASE WORKER] Found ${expiredTenants.length} expired leases. Locking statuses...`);

    // Flag rows immediately to exclude them from any other application views or background tasks
    for (const tenant of expiredTenants) {
      await lockClient.query(
        "UPDATE tenant_leases SET lease_status = 'OFFBOARDING_IN_PROGRESS' WHERE id = $1;",
        [tenant.id]
      );
    }

    // Commit Transaction 1 to lock in the operational state change
    await lockClient.query('COMMIT;');

    // -------------------------------------------------------------------------
    // TRANSACTION 2 & DDL ALTERATION: Structural Partition Decoupling
    // -------------------------------------------------------------------------
    // Run structural changes in short-lived, independent blocks to prevent pool exhaustion.
    for (const tenant of expiredTenants) {
      const ddlClient = await pool.connect();
      try {
        await ddlClient.query('BEGIN;');

        console.log(`[SECURITY AUDIT] Detaching database partition for Tenant UUID: ${tenant.tenant_id}`);

        // 1. Force an ACCESS EXCLUSIVE lock on the master partition router table
        await ddlClient.query('LOCK TABLE tenant_data_partitions IN ACCESS EXCLUSIVE MODE;');

        // 2. Detach the tenant's relational physical table slice (Air-gapping old data structure)
        // Sanitizing the table string manually safely since identifiers cannot be parameterized directly in raw SQL
        const safePartitionName = tenant.partition_name.replace(/[^a-zA-Z0-9_]/g, '');
        await ddlClient.query(`ALTER TABLE tenant_data_partitions DETACH PARTITION ${safePartitionName};`);

        // 3. Mark the lifecycle path completely closed
        await ddlClient.query(
          "UPDATE tenant_leases SET lease_status = 'OFFBOARDED', finalized_at = NOW() WHERE id = $1;",
          [tenant.id]
        );

        await ddlClient.query('COMMIT;');
        console.log(`[SUCCESS] Tenant ${tenant.tenant_id} data partition successfully isolated.`);
      } catch (ddlError) {
        await ddlClient.query('ROLLBACK;');
        console.error(`[CRITICAL DDL FAILURE] Could not detach partition for tenant ${tenant.tenant_id}:`, ddlError);
        
        // Revert status back so it can be retried on the next automated cycle
        await pool.query("UPDATE tenant_leases SET lease_status = 'GRACE_PERIOD' WHERE id = $1;", [tenant.id]);
      } finally {
        ddlClient.release();
      }
    }

  } catch (workerError) {
    await lockClient.query('ROLLBACK;');
    console.error('[CRITICAL WORKER EXCEPTION] Lease lifecycle worker crash:', workerError);
  } finally {
    lockClient.release();
  }
}
