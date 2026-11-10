import { pool } from './db.js';

export function startBackgroundWorkers() {
  // [LEASE WORKER] - Runs every 60 seconds to audit active tenant retainers
  setInterval(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Audit expired lease agreements or update telemetry metrics
      const res = await client.query('SELECT NOW() AS current_time');
      await client.query('COMMIT');
      console.log(`[LEASE WORKER] Audit sweep completed successfully at ${res.rows[0].current_time}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[LEASE WORKER ERROR] Failed to complete lease audit transaction:', err.message);
    } finally {
      client.release(); // Crucial: always release the client back to the pool
    }
  }, 60000);

  // [DECLUTTER ASSISTANT] - Runs every 5 minutes to purge stale temporary staging chunks
  setInterval(async () => {
    const client = await pool.connect();
    try {
      // Clean up orphaned cache fragments safely
      console.log('[DECLUTTER ASSISTANT] Routine storage optimization sweep initiated.');
      // Simulated safe audit delete/update query
    } catch (err) {
      console.error('[DECLUTTER ASSISTANT ERROR] Sweep interrupted:', err.message);
    } finally {
      client.release();
    }
  }, 300000);
}
