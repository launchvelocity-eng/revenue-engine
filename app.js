import pkg from 'pg';
const { Client } = pkg;

// Database connection configuration 
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Render standard PostgreSQL connections
};

/**
 * Executes a thread-safe multi-tenant lease offboarding cycle.
 * Designed to prevent race conditions during partition handling across multiple containers.
 */
export async function runLeaseOffboardingAudit() {
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // =========================================================================
    // STEP 1: CONCURRENCY SAFE ROW SELECTION
    // =========================================================================
    // Open a short-lived transaction to explicitly claim ownership of target tenants.
    // 'FOR UPDATE SKIP LOCKED' isolates rows instantly. Concurrent workers will gracefully bypass them.
    await client.query('BEGIN;');

    const selectQuery = `
      SELECT id, tenant_id, partition_name 
      FROM tenant_leases 
      WHERE expires_at <= NOW() - INTERVAL '7 days' 
        AND lease_status = 'GRACE_PERIOD'
      FOR UPDATE SKIP LOCKED;
    `;

    const { rows: expiredLeases } = await client.query(selectQuery);

    if (expiredLeases.length === 0) {
      await client.query('COMMIT;');
      console.log('[LEASE WORKER] No tenants currently eligible for offboarding isolation.');
      return;
    }

    console.log(`[LEASE WORKER] Safely locked ${expiredLeases.length} tenant(s) for offboarding.`);

    // =========================================================================
    // STEP 2: STATE ISOLATION 
    // =========================================================================
    // Transition the targeted records into an intermediate locked state. 
    // This removes them from any standard operational query visibility loops.
    for (const lease of expiredLeases) {
      await client.query(
        "UPDATE tenant_leases SET lease_status = 'OFFBOARDING_LOCKED' WHERE id = $1;",
        [lease.id]
      );
    }
    
    await client.query('COMMIT;');

    // =========================================================================
    // STEP 3: ISOLATED SCHEMA DDL MANIPULATION
    // =========================================================================
    // Run partition decoupling inside completely distinct, short transactions. 
    // This minimizes the duration of costly ACCESS EXCLUSIVE layout locks.
    for (const lease of expiredLeases) {
      await client.query('BEGIN;');
      try {
        console.log(`[LEASE WORKER] Isolating partition '${lease.partition_name}' for tenant ${lease.tenant_id}`);

        // Acquire explicit table metadata controls before altering structure
        await client.query('LOCK TABLE tenant_data_partitions IN ACCESS EXCLUSIVE MODE;');

        // Safely detach the tenant partition from the active ingestion layout
        const detachQuery = `
          ALTER TABLE tenant_data_partitions 
          DETACH PARTITION ${client.escapeIdentifier(lease.partition_name)};
        `;
        await client.query(detachQuery);

        // Finalize state resolution 
        await client.query(
          "UPDATE tenant_leases SET lease_status = 'OFFBOARDED' WHERE id = $1;",
          [lease.id]
        );

        await client.query('COMMIT;');
        console.log(`[LEASE WORKER] Successfully detached partition for tenant ${lease.tenant_id}.`);

      } catch (ddlError) {
        // Rollback the individual DDL query failure without disrupting the rest of the batch queue
        await client.query('ROLLBACK;');
        console.error(`[LEASE WORKER ERROR] Failed to detach partition for tenant ${lease.tenant_id}:`, ddlError);
        
        // Reset row state to allow fallback retries on the next automation cycle
        await client.query(
          "UPDATE tenant_leases SET lease_status = 'GRACE_PERIOD' WHERE id = $1;",
          [lease.id]
        );
      }
    }

  } catch (globalError) {
    await client.query('ROLLBACK;');
    console.error('[LEASE WORKER SYSTEM FAILURE] Global audit transaction failure:', globalError);
  } finally {
    await client.close();
  }
}
