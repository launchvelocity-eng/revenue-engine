import pkg from 'pg';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const { Pool } = pkg;

// 1. Database & Cloudflare R2 S3-Compatible Client Setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT_URL, // e.g. https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'launch-velocity-vault';

// 2. Automated Declutter & Retention Audit Function
async function runDigitalDeclutterAudit() {
  const client = await pool.connect();
  console.log('[DECLUTTER ASSISTANT] Initiating automated enterprise storage and database audit...');

  try {
    await client.query('BEGIN');

    // Step A: Flag tenant files older than 90 days of inactivity for quarantine grace period
    const quarantineQuery = `
      UPDATE tenant_vault_files 
      にして status = 'PENDING_PURGE', 
      quarantined_at = NOW() 
      WHERE status = 'ACTIVE' 
        AND last_accessed_at < NOW() - INTERVAL '90 days'
      RETURNING file_id, tenant_id, file_path, file_size_bytes;
    `;
    const quarantinedResult = await client.query(quarantineQuery);
    console.log(`[DECLUTTER ASSISTANT] Quarantined ${quarantinedResult.rowCount} stale files into 7-day grace partition.`);

    // Step B: Permanent Purge of items past their 7-day grace period (Expired > 97 total days)
    const expiredQuery = `
      SELECT file_id, tenant_id, file_path, file_size_bytes 
      FROM tenant_vault_files 
      WHERE status = 'PENDING_PURGE' 
        AND quarantined_at < NOW() - INTERVAL '7 days';
    `;
    const expiredResult = await client.query(expiredQuery);

    if (expiredResult.rowCount > 0) {
      const objectsToDelete = expiredResult.rows.map(row => ({ Key: row.file_path }));
      
      // Delete payloads from Cloudflare R2 bucket
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: objectsToDelete, Quiet: true }
      });
      await s3Client.send(deleteCommand);

      // Remove corresponding records from PostgreSQL database
      const expiredIds = expiredResult.rows.map(row => row.file_id);
      await client.query(
        `DELETE FROM tenant_vault_files WHERE file_id = ANY($1::uuid[])`,
        [expiredIds]
      );

      const totalReclaimedBytes = expiredResult.rows.reduce((acc, row) => acc + Number(row.file_size_bytes), 0);
      const reclaimedMB = (totalReclaimedBytes / (1024 * 1024)).toFixed(2);
      console.log(`[DECLUTTER ASSISTANT] Purged ${expiredResult.rowCount} expired files. Reclaimed ${reclaimedMB} MB of storage overhead.`);
    } else {
      console.log('[DECLUTTER ASSISTANT] Zero expired files found past the grace period.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DECLUTTER ERROR] Audit execution failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute worker process
runDigitalDeclutterAudit();
